import Foundation

/// Response from /api/widget/status
struct WidgetStatus: Codable {
    let overall: OverallStatus
    let services: [String: ServiceStatus]
    let errors24h: Int
    let criticalErrors24h: Int
    let uniqueUsers24h: Int
    let timestamp: String

    enum OverallStatus: String, Codable {
        case healthy
        case degraded
        case unhealthy
    }

    struct ServiceStatus: Codable {
        let status: String
        let responseMs: Int
    }

    /// Formatted timestamp for display
    var formattedTime: String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

        if let date = formatter.date(from: timestamp) {
            let displayFormatter = DateFormatter()
            displayFormatter.timeStyle = .short
            return displayFormatter.string(from: date)
        }
        return timestamp
    }

    /// Color for overall status
    var statusColor: StatusColor {
        switch overall {
        case .healthy:
            return .green
        case .degraded:
            return .yellow
        case .unhealthy:
            return .red
        }
    }

    /// Status emoji
    var statusEmoji: String {
        switch overall {
        case .healthy:
            return "🟢"
        case .degraded:
            return "🟡"
        case .unhealthy:
            return "🔴"
        }
    }
}

enum StatusColor {
    case green, yellow, red
}

/// Cached status for widget timeline
struct CachedStatus {
    let status: WidgetStatus?
    let error: String?
    let fetchedAt: Date

    var isStale: Bool {
        Date().timeIntervalSince(fetchedAt) > 15 * 60 // 15 minutes
    }
}
