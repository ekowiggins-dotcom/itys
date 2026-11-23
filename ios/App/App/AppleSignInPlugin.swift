import Foundation
import Capacitor
import AuthenticationServices

/// Sign in with Apple, using the native sheet.
/// JS: registerPlugin("AppleSignIn").authorize({ nonce }) -> { idToken, authorizationCode, givenName }
/// `nonce` is the SHA-256 (hex) of a one-time value from our server; Apple puts it in the identity token so the
/// server can check the token was made for this sign-in.
@objc(AppleSignInPlugin)
public class AppleSignInPlugin: CAPPlugin, CAPBridgedPlugin, ASAuthorizationControllerDelegate, ASAuthorizationControllerPresentationContextProviding {
    public let identifier = "AppleSignInPlugin"
    public let jsName = "AppleSignIn"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise)
    ]
    private var pending: CAPPluginCall?

    @objc func authorize(_ call: CAPPluginCall) {
        guard let nonce = call.getString("nonce"), !nonce.isEmpty else {
            call.reject("nonce is required")
            return
        }
        pending = call
        DispatchQueue.main.async {
            let request = ASAuthorizationAppleIDProvider().createRequest()
            request.requestedScopes = [.fullName, .email]
            request.nonce = nonce
            let controller = ASAuthorizationController(authorizationRequests: [request])
            controller.delegate = self
            controller.presentationContextProvider = self
            controller.performRequests()
        }
    }

    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithAuthorization authorization: ASAuthorization) {
        guard let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
              let data = credential.identityToken,
              let token = String(data: data, encoding: .utf8) else {
            pending?.reject("No identity token")
            pending = nil
            return
        }
        var result: [String: Any] = ["idToken": token]
        if let code = credential.authorizationCode, let text = String(data: code, encoding: .utf8) {
            result["authorizationCode"] = text
        }
        // Apple shares the name only the first time someone signs in to the app.
        if let given = credential.fullName?.givenName, !given.isEmpty {
            result["givenName"] = given
        }
        pending?.resolve(result)
        pending = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        let cancelled = (error as? ASAuthorizationError)?.code == .canceled
        pending?.reject(cancelled ? "cancelled" : error.localizedDescription)
        pending = nil
    }
}
