import Foundation
import Security

/// Helper for storing/retrieving sensitive data in Keychain
/// Uses App Groups for sharing between app and widget extension
enum KeychainHelper {
    private static let service = "com.ripple.DevWidget"
    private static let accessGroup = "group.com.ripple.DevWidget"
    private static let apiKeyAccount = "widget-api-key"
    private static let apiUrlAccount = "api-base-url"

    // MARK: - API Key

    static func saveAPIKey(_ key: String) -> Bool {
        deleteAPIKey() // Remove existing

        let data = key.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: apiKeyAccount,
            kSecAttrAccessGroup as String: accessGroup,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    static func getAPIKey() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: apiKeyAccount,
            kSecAttrAccessGroup as String: accessGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let key = String(data: data, encoding: .utf8) else {
            return nil
        }

        return key
    }

    static func deleteAPIKey() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: apiKeyAccount,
            kSecAttrAccessGroup as String: accessGroup,
        ]
        SecItemDelete(query as CFDictionary)
    }

    // MARK: - API Base URL

    static func saveAPIBaseURL(_ url: String) -> Bool {
        deleteAPIBaseURL()

        let data = url.data(using: .utf8)!
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: apiUrlAccount,
            kSecAttrAccessGroup as String: accessGroup,
            kSecValueData as String: data,
            kSecAttrAccessible as String: kSecAttrAccessibleAfterFirstUnlock,
        ]

        let status = SecItemAdd(query as CFDictionary, nil)
        return status == errSecSuccess
    }

    static func getAPIBaseURL() -> String? {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: apiUrlAccount,
            kSecAttrAccessGroup as String: accessGroup,
            kSecReturnData as String: true,
            kSecMatchLimit as String: kSecMatchLimitOne,
        ]

        var result: AnyObject?
        let status = SecItemCopyMatching(query as CFDictionary, &result)

        guard status == errSecSuccess,
              let data = result as? Data,
              let url = String(data: data, encoding: .utf8) else {
            return nil
        }

        return url
    }

    static func deleteAPIBaseURL() {
        let query: [String: Any] = [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: apiUrlAccount,
            kSecAttrAccessGroup as String: accessGroup,
        ]
        SecItemDelete(query as CFDictionary)
    }

    // MARK: - Configuration Check

    static var isConfigured: Bool {
        getAPIKey() != nil && getAPIBaseURL() != nil
    }
}
