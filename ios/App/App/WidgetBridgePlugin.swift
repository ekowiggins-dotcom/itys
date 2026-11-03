import Foundation
import Capacitor
import WidgetKit

/// Receives the widget's data from the web layer and stores it in the shared App Group,
/// where the WidgetKit extension reads it. JS: registerPlugin('WidgetBridge').setState({ json }).
@objc(WidgetBridgePlugin)
public class WidgetBridgePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "WidgetBridgePlugin"
    public let jsName = "WidgetBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "setState", returnType: CAPPluginReturnPromise)
    ]

    @objc func setState(_ call: CAPPluginCall) {
        guard let json = call.getString("json") else { call.reject("Missing json"); return }
        guard let group = Bundle.main.object(forInfoDictionaryKey: "SidebetAppGroup") as? String,
              let defaults = UserDefaults(suiteName: group) else { call.reject("App Group not configured"); return }
        defaults.set(json, forKey: "widgetState")
        WidgetCenter.shared.reloadAllTimelines()
        call.resolve()
    }
}
