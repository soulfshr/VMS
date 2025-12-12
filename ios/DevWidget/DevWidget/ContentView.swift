import SwiftUI
import WidgetKit

struct ContentView: View {
    @State private var status: WidgetStatus?
    @State private var error: String?
    @State private var isLoading = false
    @State private var showSettings = false
    @State private var isConfigured = KeychainHelper.isConfigured

    var body: some View {
        NavigationStack {
            Group {
                if isConfigured {
                    statusView
                } else {
                    setupPromptView
                }
            }
            .navigationTitle("VMS Status")
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button {
                        showSettings = true
                    } label: {
                        Image(systemName: "gear")
                    }
                }

                if isConfigured {
                    ToolbarItem(placement: .topBarLeading) {
                        Button {
                            Task { await fetchStatus() }
                        } label: {
                            Image(systemName: "arrow.clockwise")
                        }
                        .disabled(isLoading)
                    }
                }
            }
            .sheet(isPresented: $showSettings) {
                SettingsView(isConfigured: $isConfigured)
            }
            .task {
                if isConfigured {
                    await fetchStatus()
                }
            }
            .onChange(of: isConfigured) { _, newValue in
                if newValue {
                    Task { await fetchStatus() }
                }
            }
        }
    }

    // MARK: - Status View

    private var statusView: some View {
        ScrollView {
            VStack(spacing: 20) {
                if isLoading && status == nil {
                    ProgressView()
                        .padding(.top, 50)
                } else if let error = error, status == nil {
                    errorCard(error)
                } else if let status = status {
                    overallStatusCard(status)
                    metricsCard(status)
                    servicesCard(status)
                }
            }
            .padding()
        }
        .refreshable {
            await fetchStatus()
        }
    }

    private func overallStatusCard(_ status: WidgetStatus) -> some View {
        VStack(spacing: 12) {
            Text(status.statusEmoji)
                .font(.system(size: 60))

            Text(status.overall.rawValue.capitalized)
                .font(.title)
                .fontWeight(.bold)
                .foregroundColor(statusColor(status.statusColor))

            Text("Last updated: \(status.formattedTime)")
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: 2)
    }

    private func metricsCard(_ status: WidgetStatus) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Metrics (24h)")
                .font(.headline)

            HStack(spacing: 20) {
                metricItem(
                    icon: "person.2",
                    label: "Users",
                    value: "\(status.uniqueUsers24h)",
                    color: .blue
                )

                metricItem(
                    icon: "exclamationmark.triangle",
                    label: "Errors",
                    value: "\(status.errors24h)",
                    color: status.errors24h > 0 ? .orange : .green
                )

                metricItem(
                    icon: "xmark.octagon",
                    label: "Critical",
                    value: "\(status.criticalErrors24h)",
                    color: status.criticalErrors24h > 0 ? .red : .green
                )
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: 2)
    }

    private func metricItem(icon: String, label: String, value: String, color: Color) -> some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.title2)
                .foregroundColor(color)

            Text(value)
                .font(.title2)
                .fontWeight(.bold)

            Text(label)
                .font(.caption)
                .foregroundColor(.secondary)
        }
        .frame(maxWidth: .infinity)
    }

    private func servicesCard(_ status: WidgetStatus) -> some View {
        VStack(alignment: .leading, spacing: 16) {
            Text("Services")
                .font(.headline)

            ForEach(Array(status.services.keys.sorted()), id: \.self) { key in
                if let service = status.services[key] {
                    serviceRow(name: key, service: service)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
        .shadow(color: .black.opacity(0.1), radius: 5, x: 0, y: 2)
    }

    private func serviceRow(name: String, service: WidgetStatus.ServiceStatus) -> some View {
        HStack {
            Circle()
                .fill(serviceStatusColor(service.status))
                .frame(width: 12, height: 12)

            Text(name.capitalized)
                .font(.body)

            Spacer()

            Text("\(service.responseMs)ms")
                .font(.caption)
                .foregroundColor(.secondary)

            Text(service.status.capitalized)
                .font(.caption)
                .fontWeight(.medium)
                .foregroundColor(serviceStatusColor(service.status))
        }
        .padding(.vertical, 4)
    }

    private func errorCard(_ error: String) -> some View {
        VStack(spacing: 12) {
            Image(systemName: "exclamationmark.triangle")
                .font(.largeTitle)
                .foregroundColor(.orange)

            Text("Failed to load status")
                .font(.headline)

            Text(error)
                .font(.caption)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)

            Button("Retry") {
                Task { await fetchStatus() }
            }
            .buttonStyle(.bordered)
        }
        .frame(maxWidth: .infinity)
        .padding()
        .background(Color(.systemBackground))
        .cornerRadius(12)
    }

    // MARK: - Setup Prompt

    private var setupPromptView: some View {
        VStack(spacing: 20) {
            Spacer()

            Image(systemName: "gear.badge.questionmark")
                .font(.system(size: 60))
                .foregroundColor(.secondary)

            Text("Widget Not Configured")
                .font(.title2)
                .fontWeight(.bold)

            Text("Enter your API key and server URL to start monitoring your VMS health status.")
                .font(.body)
                .foregroundColor(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            Button {
                showSettings = true
            } label: {
                Label("Configure", systemImage: "gear")
                    .frame(maxWidth: .infinity)
            }
            .buttonStyle(.borderedProminent)
            .padding(.horizontal, 40)

            Spacer()
        }
        .padding()
    }

    // MARK: - Helpers

    private func fetchStatus() async {
        isLoading = true
        error = nil

        do {
            status = try await APIClient.fetchStatus()
            // Refresh widget timeline
            WidgetCenter.shared.reloadAllTimelines()
        } catch {
            self.error = error.localizedDescription
        }

        isLoading = false
    }

    private func statusColor(_ color: StatusColor) -> Color {
        switch color {
        case .green: return .green
        case .yellow: return .orange
        case .red: return .red
        }
    }

    private func serviceStatusColor(_ status: String) -> Color {
        switch status {
        case "healthy": return .green
        case "degraded": return .orange
        default: return .red
        }
    }
}

#Preview {
    ContentView()
}
