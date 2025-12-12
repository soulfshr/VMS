import Foundation

/// API client for fetching widget status
enum APIClient {
    enum APIError: Error, LocalizedError {
        case notConfigured
        case invalidURL
        case unauthorized
        case networkError(Error)
        case decodingError(Error)
        case serverError(Int)

        var errorDescription: String? {
            switch self {
            case .notConfigured:
                return "API not configured"
            case .invalidURL:
                return "Invalid API URL"
            case .unauthorized:
                return "Unauthorized - check API key"
            case .networkError(let error):
                return "Network error: \(error.localizedDescription)"
            case .decodingError:
                return "Invalid response"
            case .serverError(let code):
                return "Server error (\(code))"
            }
        }
    }

    /// Fetch current widget status
    static func fetchStatus() async throws -> WidgetStatus {
        guard let apiKey = KeychainHelper.getAPIKey(),
              let baseURL = KeychainHelper.getAPIBaseURL() else {
            throw APIError.notConfigured
        }

        guard let url = URL(string: "\(baseURL)/api/widget/status") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Accept")
        request.timeoutInterval = 10

        do {
            let (data, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.serverError(0)
            }

            switch httpResponse.statusCode {
            case 200:
                break
            case 401:
                throw APIError.unauthorized
            default:
                throw APIError.serverError(httpResponse.statusCode)
            }

            let decoder = JSONDecoder()
            do {
                return try decoder.decode(WidgetStatus.self, from: data)
            } catch {
                throw APIError.decodingError(error)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }

    /// Register device token for push notifications
    static func registerDeviceToken(_ token: String) async throws {
        guard let apiKey = KeychainHelper.getAPIKey(),
              let baseURL = KeychainHelper.getAPIBaseURL() else {
            throw APIError.notConfigured
        }

        guard let url = URL(string: "\(baseURL)/api/widget/register-device") else {
            throw APIError.invalidURL
        }

        var request = URLRequest(url: url)
        request.httpMethod = "POST"
        request.setValue("Bearer \(apiKey)", forHTTPHeaderField: "Authorization")
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.timeoutInterval = 10

        let body = ["deviceToken": token]
        request.httpBody = try JSONSerialization.data(withJSONObject: body)

        do {
            let (_, response) = try await URLSession.shared.data(for: request)

            guard let httpResponse = response as? HTTPURLResponse else {
                throw APIError.serverError(0)
            }

            if httpResponse.statusCode == 401 {
                throw APIError.unauthorized
            } else if httpResponse.statusCode >= 400 {
                throw APIError.serverError(httpResponse.statusCode)
            }
        } catch let error as APIError {
            throw error
        } catch {
            throw APIError.networkError(error)
        }
    }
}
