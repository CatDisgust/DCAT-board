import Foundation
import HealthKit

final class HealthKitService: @unchecked Sendable {
    static let shared = HealthKitService()

    private final class ObserverCompletion: @unchecked Sendable {
        private let handler: () -> Void

        init(_ handler: @escaping () -> Void) {
            self.handler = handler
        }

        func call() {
            handler()
        }
    }

    private let store = HKHealthStore()
    private var observerQueries: [HKObserverQuery] = []
    private let isoFormatter = ISO8601DateFormatter()

    private var sleepType: HKCategoryType {
        HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!
    }

    private var bodyMassType: HKQuantityType {
        HKObjectType.quantityType(forIdentifier: .bodyMass)!
    }

    private var activeEnergyType: HKQuantityType {
        HKObjectType.quantityType(forIdentifier: .activeEnergyBurned)!
    }

    var isAvailable: Bool { HKHealthStore.isHealthDataAvailable() }

    private init() {
        isoFormatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    }

    func requestAuthorization() async throws {
        guard isAvailable else { throw SyncError.healthDataUnavailable }
        let readTypes: Set<HKObjectType> = [sleepType, bodyMassType, activeEnergyType]
        try await store.requestAuthorization(toShare: [], read: readTypes)
        UserDefaults.standard.set(true, forKey: "daymark.health.permission.requested")
        enableBackgroundDelivery()
    }

    func configureBackgroundDelivery(onUpdate: @escaping @Sendable () async -> Void) {
        guard isAvailable, observerQueries.isEmpty else { return }
        for type in [sleepType, bodyMassType, activeEnergyType] as [HKSampleType] {
            let query = HKObserverQuery(sampleType: type, predicate: nil) { _, completion, _ in
                let completionBox = ObserverCompletion(completion)
                Task {
                    await onUpdate()
                    completionBox.call()
                }
            }
            observerQueries.append(query)
            store.execute(query)
        }
        enableBackgroundDelivery()
    }

    func makeSyncBatch(days: Int, timezone: TimeZone) async throws -> HealthSyncBatch {
        guard isAvailable else { throw SyncError.healthDataUnavailable }
        let calendar = calendar(for: timezone)
        let end = Date()
        let start = calendar.date(byAdding: .day, value: -max(days, 1), to: calendar.startOfDay(for: end))!

        async let sleepResult = anchoredSamples(
            type: sleepType,
            from: start,
            to: end,
            anchorKey: HKCategoryTypeIdentifier.sleepAnalysis.rawValue
        )
        async let weightResult = anchoredSamples(
            type: bodyMassType,
            from: start,
            to: end,
            anchorKey: HKQuantityTypeIdentifier.bodyMass.rawValue
        )
        async let energySamples = dailyActiveEnergy(from: start, to: end, calendar: calendar)

        let (sleep, weight, energy) = try await (sleepResult, weightResult, energySamples)
        let sleepPayloads: [HealthSamplePayload] = sleep.samples.compactMap { sample -> HealthSamplePayload? in
            guard let category = sample as? HKCategorySample else { return nil }
            return sleepPayload(from: category, calendar: calendar)
        }
        let weightPayloads: [HealthSamplePayload] = weight.samples.compactMap { sample -> HealthSamplePayload? in
            guard let quantity = sample as? HKQuantitySample else { return nil }
            return quantityPayload(from: quantity, calendar: calendar)
        }

        var anchors: [String: HKQueryAnchor] = [:]
        if let anchor = sleep.anchor {
            anchors[HKCategoryTypeIdentifier.sleepAnalysis.rawValue] = anchor
        }
        if let anchor = weight.anchor {
            anchors[HKQuantityTypeIdentifier.bodyMass.rawValue] = anchor
        }

        return HealthSyncBatch(
            samples: sleepPayloads + weightPayloads + energy,
            deletedIdentifiers:
                (sleep.deleted + weight.deleted).map(\.uuid.uuidString)
                + activeEnergyIdentifiers(from: start, to: end, calendar: calendar),
            anchors: anchors
        )
    }

    private func anchoredSamples(
        type: HKSampleType,
        from start: Date,
        to end: Date,
        anchorKey: String
    ) async throws -> (samples: [HKSample], deleted: [HKDeletedObject], anchor: HKQueryAnchor?) {
        try await withCheckedThrowingContinuation { continuation in
            let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
            let query = HKAnchoredObjectQuery(
                type: type,
                predicate: predicate,
                anchor: AnchorStore.load(for: anchorKey),
                limit: HKObjectQueryNoLimit
            ) { _, samples, deleted, anchor, error in
                if let error {
                    continuation.resume(throwing: error)
                } else {
                    continuation.resume(returning: (samples ?? [], deleted ?? [], anchor))
                }
            }
            store.execute(query)
        }
    }

    private func dailyActiveEnergy(
        from start: Date,
        to end: Date,
        calendar: Calendar
    ) async throws -> [HealthSamplePayload] {
        let predicate = HKQuery.predicateForSamples(withStart: start, end: end, options: [])
        let interval = DateComponents(day: 1)

        return try await withCheckedThrowingContinuation { continuation in
            let query = HKStatisticsCollectionQuery(
                quantityType: activeEnergyType,
                quantitySamplePredicate: predicate,
                options: .cumulativeSum,
                anchorDate: calendar.startOfDay(for: start),
                intervalComponents: interval
            )
            query.initialResultsHandler = { [weak self] _, collection, error in
                guard let self else { return }
                if let error {
                    continuation.resume(throwing: error)
                    return
                }
                var output: [HealthSamplePayload] = []
                collection?.enumerateStatistics(
                    from: calendar.startOfDay(for: start),
                    to: end
                ) { statistics, _ in
                    guard let quantity = statistics.sumQuantity() else { return }
                    let value = quantity.doubleValue(for: .kilocalorie())
                    let recordDate = self.dateString(statistics.startDate, calendar: calendar)
                    output.append(HealthSamplePayload(
                        sourceIdentifier: "active-energy:\(recordDate)",
                        sampleType: "active_energy",
                        sampleSubtype: nil,
                        recordDate: recordDate,
                        startAt: self.isoFormatter.string(from: statistics.startDate),
                        endAt: self.isoFormatter.string(from: statistics.endDate),
                        value: value,
                        unit: "kcal",
                        sourceBundleID: "com.apple.Health",
                        sourceName: "Apple Health daily total",
                        deviceName: nil,
                        metadata: ["aggregation": "cumulative_sum"]
                    ))
                }
                continuation.resume(returning: output)
            }
            store.execute(query)
        }
    }

    private func activeEnergyIdentifiers(
        from start: Date,
        to end: Date,
        calendar: Calendar
    ) -> [String] {
        var identifiers: [String] = []
        var cursor = calendar.startOfDay(for: start)
        while cursor < end {
            identifiers.append("active-energy:\(dateString(cursor, calendar: calendar))")
            guard let next = calendar.date(byAdding: .day, value: 1, to: cursor) else { break }
            cursor = next
        }
        return identifiers
    }

    private func enableBackgroundDelivery() {
        for type in [sleepType, bodyMassType, activeEnergyType] as [HKSampleType] {
            store.enableBackgroundDelivery(for: type, frequency: .hourly) { _, _ in }
        }
    }

    private func sleepPayload(
        from sample: HKCategorySample,
        calendar: Calendar
    ) -> HealthSamplePayload {
        HealthSamplePayload(
            sourceIdentifier: sample.uuid.uuidString,
            sampleType: "sleep",
            sampleSubtype: sleepStage(sample.value),
            recordDate: dateString(sample.endDate, calendar: calendar),
            startAt: isoFormatter.string(from: sample.startDate),
            endAt: isoFormatter.string(from: sample.endDate),
            value: nil,
            unit: nil,
            sourceBundleID: sample.sourceRevision.source.bundleIdentifier,
            sourceName: sample.sourceRevision.source.name,
            deviceName: sample.device?.name,
            metadata: [:]
        )
    }

    private func quantityPayload(
        from sample: HKQuantitySample,
        calendar: Calendar
    ) -> HealthSamplePayload {
        HealthSamplePayload(
            sourceIdentifier: sample.uuid.uuidString,
            sampleType: "body_mass",
            sampleSubtype: nil,
            recordDate: dateString(sample.endDate, calendar: calendar),
            startAt: isoFormatter.string(from: sample.startDate),
            endAt: isoFormatter.string(from: sample.endDate),
            value: sample.quantity.doubleValue(for: .gramUnit(with: .kilo)),
            unit: "kg",
            sourceBundleID: sample.sourceRevision.source.bundleIdentifier,
            sourceName: sample.sourceRevision.source.name,
            deviceName: sample.device?.name,
            metadata: [:]
        )
    }

    private func sleepStage(_ value: Int) -> String {
        switch value {
        case HKCategoryValueSleepAnalysis.inBed.rawValue: "in_bed"
        case HKCategoryValueSleepAnalysis.awake.rawValue: "awake"
        case HKCategoryValueSleepAnalysis.asleepCore.rawValue: "core"
        case HKCategoryValueSleepAnalysis.asleepDeep.rawValue: "deep"
        case HKCategoryValueSleepAnalysis.asleepREM.rawValue: "rem"
        case HKCategoryValueSleepAnalysis.asleepUnspecified.rawValue: "unspecified"
        default: "asleep"
        }
    }

    private func calendar(for timezone: TimeZone) -> Calendar {
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = timezone
        return calendar
    }

    private func dateString(_ date: Date, calendar: Calendar) -> String {
        let components = calendar.dateComponents([.year, .month, .day], from: date)
        return String(
            format: "%04d-%02d-%02d",
            components.year ?? 0,
            components.month ?? 0,
            components.day ?? 0
        )
    }
}
