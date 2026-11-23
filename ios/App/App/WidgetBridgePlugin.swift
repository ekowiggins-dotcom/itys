import Foundation
import Capacitor
import WidgetKit

/// Lets the web app hand the home-screen widget what it needs to fetch its numbers: the site's address and a
/// read-only widget token. Both live in the App Group shared with the widget extension.
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "configure", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "clear", returnType: CAPPluginReturnPromise),
    ]

    private var defaults: UserDefaults? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "WhollAppGroup") as? String else { return nil }
        return UserDefaults(suiteName: group)
    }

    @objc func configure(_ call: CAPPluginCall) {
        guard let token = call.getString("token"), let baseUrl = call.getString("baseUrl") else {
            call.reject("token and baseUrl are required")
            return
        }
        defaults?.set(token, forKey: "widgetToken")
        defaults?.set(baseUrl, forKey: "baseUrl")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }

    /// Called on sign-out so the widget stops showing anything.
    @objc func clear(_ call: CAPPluginCall) {
        defaults?.removeObject(forKey: "widgetToken")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
