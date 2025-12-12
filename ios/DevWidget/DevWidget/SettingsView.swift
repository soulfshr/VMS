import SwiftUI
import WidgetKit

struct SettingsView: View {
    @Environment(\.dismiss) private var dismiss
    @Binding var isConfigured: Bool

    @State private var apiKey: String = ""
    @State private var baseURL: String = ""
    @State private var showAPIKey = false
    @State private var isSaving = false
    @State private var error: String?
    @State private var showDeleteConfirmation = false

    var body: some View {
        NavigationStack {
            Form {
                Section {
                    HStack {
                        if showAPIKey {
                            TextField("API Key", text: $apiKey)
                                .textContentType(.password)
                                .autocapitalization(.none)
                                .autocorrectionDisabled()
                        } else {
                            SecureField("API Key", text: $apiKey)
                                .textContentType(.password)
                                .autocapitalization(.none)
                                .autocorrectionDisabled()
                        }

                        Button {
                            showAPIKey.toggle()
                        } label: {
                            Image(systemName: showAPIKey ? "eye.slash" : "eye")
                                .foregroundColor(.secondary)
                        }
                    }

                    TextField("Server URL", text: $baseURL)
                        .textContentType(.URL)
                        .autocapitalization(.none)
                        .autocorrectionDisabled()
                        .keyboardType(.URL)
                } header: {
                    Text("API Configuration")
                } footer: {
                    Text("Get your API key from the VMS Developer dashboard. Server URL should be like https://nc.ripple-vms.com")
                }

                if let error = error {
                    Section {
                        HStack {
                            Image(systemName: "exclamationmark.triangle")
                                .foregroundColor(.orange)
                            Text(error)
                                .foregroundColor(.secondary)
                        }
                    }
                }

                Section {
                    Button {
                        Task { await testAndSave() }
                    } label: {
                        HStack {
                            Spacer()
                            if isSaving {
                                ProgressView()
                            } else {
                                Text("Save & Test Connection")
                            }
                            Spacer()
                        }
                    }
                    .disabled(apiKey.isEmpty || baseURL.isEmpty || isSaving)
                }

                if isConfigured {
                    Section {
                        Button(role: .destructive) {
                            showDeleteConfirmation = true
                        } label: {
                            HStack {
                                Spacer()
                                Text("Clear Configuration")
                                Spacer()
                            }
                        }
                    }
                }

                Section {
                    Text("How to get an API key:")
                        .font(.headline)

                    VStack(alignment: .leading, spacing: 8) {
                        instructionRow(number: 1, text: "Log in to your VMS as a Developer")
                        instructionRow(number: 2, text: "Go to Developer > Widget Keys")
                        instructionRow(number: 3, text: "Create a new API key")
                        instructionRow(number: 4, text: "Copy the key (only shown once!)")
                    }
                } header: {
                    Text("Help")
                }
            }
            .navigationTitle("Settings")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .topBarTrailing) {
                    Button("Done") {
                        dismiss()
                    }
                }
            }
            .confirmationDialog(
                "Clear Configuration",
                isPresented: $showDeleteConfirmation,
                titleVisibility: .visible
            ) {
                Button("Clear", role: .destructive) {
                    clearConfiguration()
                }
                Button("Cancel", role: .cancel) {}
            } message: {
                Text("This will remove your API key and server URL. You'll need to reconfigure the widget.")
            }
            .onAppear {
                loadExistingConfiguration()
            }
        }
    }

    private func instructionRow(number: Int, text: String) -> some View {
        HStack(alignment: .top, spacing: 12) {
            Text("\(number)")
                .font(.caption)
                .fontWeight(.bold)
                .foregroundColor(.white)
                .frame(width: 20, height: 20)
                .background(Color.blue)
                .clipShape(Circle())

            Text(text)
                .font(.subheadline)
                .foregroundColor(.secondary)
        }
    }

    private func loadExistingConfiguration() {
        // Don't show existing API key for security
        if let existingURL = KeychainHelper.getAPIBaseURL() {
            baseURL = existingURL
        }
        if KeychainHelper.getAPIKey() != nil {
            apiKey = "••••••••••••••••" // Placeholder
        }
    }

    private func testAndSave() async {
        isSaving = true
        error = nil

        // Normalize URL
        var normalizedURL = baseURL.trimmingCharacters(in: .whitespacesAndNewlines)
        if normalizedURL.hasSuffix("/") {
            normalizedURL.removeLast()
        }
        if !normalizedURL.hasPrefix("http") {
            normalizedURL = "https://\(normalizedURL)"
        }

        // Save temporarily to test
        let savedKey = KeychainHelper.saveAPIKey(apiKey)
        let savedURL = KeychainHelper.saveAPIBaseURL(normalizedURL)

        guard savedKey && savedURL else {
            error = "Failed to save credentials"
            isSaving = false
            return
        }

        // Test the connection
        do {
            _ = try await APIClient.fetchStatus()

            // Success!
            isConfigured = true

            // Refresh widgets
            WidgetCenter.shared.reloadAllTimelines()

            await MainActor.run {
                dismiss()
            }
        } catch {
            self.error = "Connection failed: \(error.localizedDescription)"
            // Clear the failed credentials
            KeychainHelper.deleteAPIKey()
            KeychainHelper.deleteAPIBaseURL()
        }

        isSaving = false
    }

    private func clearConfiguration() {
        KeychainHelper.deleteAPIKey()
        KeychainHelper.deleteAPIBaseURL()
        apiKey = ""
        baseURL = ""
        isConfigured = false
        WidgetCenter.shared.reloadAllTimelines()
    }
}

#Preview {
    SettingsView(isConfigured: .constant(false))
}
