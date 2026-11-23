import UIKit
import Capacitor

/// The app's web view controller. Registers the app's own native plugins with Capacitor.
class AppViewController: CAPBridgeViewController {
    override open func capacitorDidLoad() {
        bridge?.registerPluginInstance(WidgetBridgePlugin())
        bridge?.registerPluginInstance(AppleSignInPlugin())
    }
}
