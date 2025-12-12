import WidgetKit
import SwiftUI

// MARK: - Timeline Provider

struct StatusProvider: TimelineProvider {
    func placeholder(in context: Context) -> StatusEntry {
        StatusEntry(date: Date(), status: nil, error: nil)
    }

    func getSnapshot(in context: Context, completion: @escaping (StatusEntry) -> Void) {
        // For preview, show a mock healthy status
        if context.isPreview {
            let mockStatus = WidgetStatus(
                overall: .healthy,
                services: [
                    "database": .init(status: "healthy", responseMs: 12),
                    "email": .init(status: "healthy", responseMs: 45),
                    "redis": .init(status: "healthy", responseMs: 8)
                ],
                errors24h: 2,
                criticalErrors24h: 0,
                uniqueUsers24h: 47,
                timestamp: ISO8601DateFormatter().string(from: Date())
            )
            completion(StatusEntry(date: Date(), status: mockStatus, error: nil))
            return
        }

        // Fetch real data
        Task {
            do {
                let status = try await APIClient.fetchStatus()
                completion(StatusEntry(date: Date(), status: status, error: nil))
            } catch {
                completion(StatusEntry(date: Date(), status: nil, error: error.localizedDescription))
            }
        }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<StatusEntry>) -> Void) {
        Task {
            var entry: StatusEntry

            do {
                let status = try await APIClient.fetchStatus()
                entry = StatusEntry(date: Date(), status: status, error: nil)
            } catch {
                entry = StatusEntry(date: Date(), status: nil, error: error.localizedDescription)
            }

            // Refresh every 15 minutes
            let nextUpdate = Calendar.current.date(byAdding: .minute, value: 15, to: Date())!
            let timeline = Timeline(entries: [entry], policy: .after(nextUpdate))
            completion(timeline)
        }
    }
}

// MARK: - Timeline Entry

struct StatusEntry: TimelineEntry {
    let date: Date
    let status: WidgetStatus?
    let error: String?
}

// MARK: - Widget Views

struct StatusWidgetEntryView: View {
    var entry: StatusProvider.Entry
    @Environment(\.widgetFamily) var family

    var body: some View {
        switch family {
        case .systemSmall:
            SmallWidgetView(entry: entry)
        case .systemMedium:
            MediumWidgetView(entry: entry)
        default:
            SmallWidgetView(entry: entry)
        }
    }
}

// MARK: - Small Widget

struct SmallWidgetView: View {
    let entry: StatusEntry

    var body: some View {
        if let status = entry.status {
            VStack(alignment: .leading, spacing: 8) {
                // Header with status
                HStack {
                    Text(status.statusEmoji)
                        .font(.title2)
                    Spacer()
                    Text(status.formattedTime)
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Spacer()

                // Key metrics
                VStack(alignment: .leading, spacing: 4) {
                    MetricRow(label: "Users", value: "\(status.uniqueUsers24h)")
                    MetricRow(label: "Errors", value: "\(status.errors24h)", isAlert: status.errors24h > 0)
                }

                Spacer()

                // Overall status text
                Text(status.overall.rawValue.capitalized)
                    .font(.caption)
                    .fontWeight(.medium)
                    .foregroundColor(statusTextColor(status.statusColor))
            }
            .padding()
        } else if let error = entry.error {
            VStack(spacing: 8) {
                Image(systemName: "exclamationmark.triangle")
                    .font(.title)
                    .foregroundColor(.orange)
                Text("Error")
                    .font(.caption)
                    .fontWeight(.medium)
                Text(error)
                    .font(.caption2)
                    .foregroundColor(.secondary)
                    .multilineTextAlignment(.center)
                    .lineLimit(2)
            }
            .padding()
        } else {
            VStack(spacing: 8) {
                Image(systemName: "gear")
                    .font(.title)
                    .foregroundColor(.secondary)
                Text("Not Configured")
                    .font(.caption)
                Text("Open app to set up")
                    .font(.caption2)
                    .foregroundColor(.secondary)
            }
            .padding()
        }
    }

    private func statusTextColor(_ color: StatusColor) -> Color {
        switch color {
        case .green: return .green
        case .yellow: return .orange
        case .red: return .red
        }
    }
}

// MARK: - Medium Widget

struct MediumWidgetView: View {
    let entry: StatusEntry

    var body: some View {
        if let status = entry.status {
            HStack(spacing: 16) {
                // Left side - overall status
                VStack(alignment: .leading, spacing: 8) {
                    HStack {
                        Text(status.statusEmoji)
                            .font(.largeTitle)
                        Text(status.overall.rawValue.capitalized)
                            .font(.headline)
                            .foregroundColor(statusTextColor(status.statusColor))
                    }

                    Spacer()

                    VStack(alignment: .leading, spacing: 4) {
                        MetricRow(label: "Users (24h)", value: "\(status.uniqueUsers24h)")
                        MetricRow(label: "Errors (24h)", value: "\(status.errors24h)", isAlert: status.errors24h > 0)
                        if status.criticalErrors24h > 0 {
                            MetricRow(label: "Critical", value: "\(status.criticalErrors24h)", isAlert: true)
                        }
                    }

                    Text("Updated \(status.formattedTime)")
                        .font(.caption2)
                        .foregroundColor(.secondary)
                }

                Divider()

                // Right side - services
                VStack(alignment: .leading, spacing: 6) {
                    Text("Services")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundColor(.secondary)

                    ForEach(Array(status.services.keys.sorted()), id: \.self) { key in
                        if let service = status.services[key] {
                            ServiceRow(name: key, status: service.status, responseMs: service.responseMs)
                        }
                    }

                    Spacer()
                }
            }
            .padding()
        } else if let error = entry.error {
            HStack {
                Image(systemName: "exclamationmark.triangle")
                    .font(.largeTitle)
                    .foregroundColor(.orange)
                VStack(alignment: .leading) {
                    Text("Error fetching status")
                        .font(.headline)
                    Text(error)
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .padding()
        } else {
            HStack {
                Image(systemName: "gear")
                    .font(.largeTitle)
                    .foregroundColor(.secondary)
                VStack(alignment: .leading) {
                    Text("Widget Not Configured")
                        .font(.headline)
                    Text("Open the app to enter your API key")
                        .font(.caption)
                        .foregroundColor(.secondary)
                }
                Spacer()
            }
            .padding()
        }
    }

    private func statusTextColor(_ color: StatusColor) -> Color {
        switch color {
        case .green: return .green
        case .yellow: return .orange
        case .red: return .red
        }
    }
}

// MARK: - Helper Views

struct MetricRow: View {
    let label: String
    let value: String
    var isAlert: Bool = false

    var body: some View {
        HStack {
            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
            Spacer()
            Text(value)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(isAlert ? .red : .primary)
        }
    }
}

struct ServiceRow: View {
    let name: String
    let status: String
    let responseMs: Int

    var body: some View {
        HStack(spacing: 6) {
            Circle()
                .fill(statusColor)
                .frame(width: 8, height: 8)
            Text(name.capitalized)
                .font(.caption)
            Spacer()
            Text("\(responseMs)ms")
                .font(.caption2)
                .foregroundColor(.secondary)
        }
    }

    private var statusColor: Color {
        switch status {
        case "healthy": return .green
        case "degraded": return .orange
        default: return .red
        }
    }
}

// MARK: - Widget Configuration

struct StatusWidget: Widget {
    let kind: String = "StatusWidget"

    var body: some WidgetConfiguration {
        StaticConfiguration(kind: kind, provider: StatusProvider()) { entry in
            StatusWidgetEntryView(entry: entry)
                .containerBackground(.fill.tertiary, for: .widget)
        }
        .configurationDisplayName("VMS Status")
        .description("Monitor your RippleVMS health status")
        .supportedFamilies([.systemSmall, .systemMedium])
    }
}

// MARK: - Preview

#Preview(as: .systemSmall) {
    StatusWidget()
} timeline: {
    StatusEntry(
        date: Date(),
        status: WidgetStatus(
            overall: .healthy,
            services: [
                "database": .init(status: "healthy", responseMs: 12),
                "email": .init(status: "healthy", responseMs: 45),
                "redis": .init(status: "healthy", responseMs: 8)
            ],
            errors24h: 2,
            criticalErrors24h: 0,
            uniqueUsers24h: 47,
            timestamp: ISO8601DateFormatter().string(from: Date())
        ),
        error: nil
    )
}

#Preview(as: .systemMedium) {
    StatusWidget()
} timeline: {
    StatusEntry(
        date: Date(),
        status: WidgetStatus(
            overall: .degraded,
            services: [
                "database": .init(status: "healthy", responseMs: 12),
                "email": .init(status: "degraded", responseMs: 450),
                "redis": .init(status: "healthy", responseMs: 8)
            ],
            errors24h: 15,
            criticalErrors24h: 2,
            uniqueUsers24h: 47,
            timestamp: ISO8601DateFormatter().string(from: Date())
        ),
        error: nil
    )
}
