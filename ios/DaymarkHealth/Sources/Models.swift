import Foundation
import HealthKit

struct HealthSamplePayload: Encodable, Sendable {
    let sourceIdentifier: String
    let sampleType: String
    let sampleSubtype: String?
    let recordDate: String
    let startAt: String
    let endAt: String
    let value: Double?
    let unit: String?
    let sourceBundleID: String?
    let sourceName: String?
    let deviceName: String?
    let metadata: [String: String]

    enum CodingKeys: String, CodingKey {
        case sourceIdentifier = "source_identifier"
        case sampleType = "sample_type"
        case sampleSubtype = "sample_subtype"
        case recordDate = "record_date"
        case startAt = "start_at"
        case endAt = "end_at"
        case value
        case unit
        case sourceBundleID = "source_bundle_id"
        case sourceName = "source_name"
        case deviceName = "device_name"
        case metadata
    }
}

struct HealthSyncBatch: @unchecked Sendable {
    let samples: [HealthSamplePayload]
    let deletedIdentifiers: [String]
    let anchors: [String: HKQueryAnchor]
}

struct ProfileTimezone: Decodable {
    let timezone: String
}

struct IngestHealthParams: Encodable {
    let samples: [HealthSamplePayload]
    let deletedIdentifiers: [String]
    let deviceID: String
    let deviceName: String
    let appVersion: String
    let permissions: [String: Bool]

    enum CodingKeys: String, CodingKey {
        case samples = "p_samples"
        case deletedIdentifiers = "p_deleted_source_identifiers"
        case deviceID = "p_device_id"
        case deviceName = "p_device_name"
        case appVersion = "p_app_version"
        case permissions = "p_permissions"
    }
}
