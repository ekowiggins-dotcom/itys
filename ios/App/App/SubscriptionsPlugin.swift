import Foundation
import Capacitor
import StoreKit

/// Who'll Pro, with StoreKit 2. The web app shows the screens; this plugin talks to the App Store, and the web app
/// sends the signed transactions it returns to our server, which verifies them (src/server/subscriptions.ts).
///
/// JS: registerPlugin("Subscriptions")
///   .products({ ids })                      -> { products: [{ id, displayName, displayPrice, periodUnit, periodValue, freeTrialDays }] }
///   .purchase({ id, appAccountToken })      -> { status: "purchased" | "pending" | "cancelled", transaction?, renewals? }
///   .entitlements({ ids })                  -> { transactions: [jws], renewals: [jws] }   (what this Apple ID has now)
///   .restore({ ids })                       -> same, after syncing with the App Store ("Restore purchases")
///   .manage()                               -> opens Apple's manage-subscriptions sheet
///   event "transaction" { transaction }     -> renewals, Ask to Buy approvals and purchases made outside the app
@objc(SubscriptionsPlugin)
public class SubscriptionsPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SubscriptionsPlugin"
    public let jsName = "Subscriptions"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "products", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "purchase", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "entitlements", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "restore", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "manage", returnType: CAPPluginReturnPromise)
    ]
    private var updates: Task<Void, Never>?

    override public func load() {
        // Transactions that happen while the app isn't on the purchase screen (renewals, Ask to Buy, offer codes).
        updates = Task.detached { [weak self] in
            for await result in Transaction.updates {
                if case .verified(let transaction) = result { await transaction.finish() }
                self?.notifyListeners("transaction", data: ["transaction": result.jwsRepresentation], retainUntilConsumed: true)
            }
        }
    }

    deinit { updates?.cancel() }

    private func ids(_ call: CAPPluginCall) -> [String] {
        return (call.getArray("ids") as? [String]) ?? []
    }

    private static func unit(_ u: Product.SubscriptionPeriod.Unit) -> String {
        switch u {
        case .day: return "day"
        case .week: return "week"
        case .month: return "month"
        case .year: return "year"
        @unknown default: return "month"
        }
    }

    private static func days(_ p: Product.SubscriptionPeriod) -> Int {
        switch p.unit {
        case .day: return p.value
        case .week: return p.value * 7
        case .month: return p.value * 30
        case .year: return p.value * 365
        @unknown default: return p.value
        }
    }

    @objc func products(_ call: CAPPluginCall) {
        let wanted = ids(call)
        Task {
            do {
                let found = try await Product.products(for: wanted)
                var list: [[String: Any]] = []
                for id in wanted {
                    guard let p = found.first(where: { $0.id == id }), let sub = p.subscription else { continue }
                    var item: [String: Any] = [
                        "id": p.id,
                        "displayName": p.displayName,
                        "displayPrice": p.displayPrice,
                        "periodUnit": Self.unit(sub.subscriptionPeriod.unit),
                        "periodValue": sub.subscriptionPeriod.value
                    ]
                    // The free trial is shown only to people who can still get it (one per Apple ID).
                    if let intro = sub.introductoryOffer, intro.paymentMode == .freeTrial, await sub.isEligibleForIntroOffer {
                        item["freeTrialDays"] = Self.days(intro.period)
                    }
                    list.append(item)
                }
                call.resolve(["products": list])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    @objc func purchase(_ call: CAPPluginCall) {
        guard let id = call.getString("id"),
              let token = call.getString("appAccountToken").flatMap({ UUID(uuidString: $0) }) else {
            call.reject("id and appAccountToken are required")
            return
        }
        Task {
            do {
                guard let product = try await Product.products(for: [id]).first else {
                    call.reject("This subscription isn’t available right now.")
                    return
                }
                // appAccountToken is the Who'll user id: Apple signs it into the transaction so the server knows whose it is.
                let result = try await product.purchase(options: [.appAccountToken(token)])
                switch result {
                case .success(let verification):
                    if case .verified(let transaction) = verification { await transaction.finish() }
                    var data: [String: Any] = ["status": "purchased", "transaction": verification.jwsRepresentation]
                    data["renewals"] = await self.current([id])["renewals"]
                    call.resolve(data)
                case .pending:
                    call.resolve(["status": "pending"])
                case .userCancelled:
                    call.resolve(["status": "cancelled"])
                @unknown default:
                    call.resolve(["status": "cancelled"])
                }
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private func current(_ wanted: [String]) async -> [String: Any] {
        var transactions: [String] = []
        for await result in Transaction.currentEntitlements {
            if wanted.isEmpty || wanted.contains(result.unsafePayloadValue.productID) {
                transactions.append(result.jwsRepresentation)
            }
        }
        // Renewal info says whether it will renew and about billing problems. Both products share one group.
        var renewals: [String] = []
        if let first = wanted.first,
           let product = try? await Product.products(for: [first]).first,
           let statuses = try? await product.subscription?.status {
            renewals = statuses.map { $0.renewalInfo.jwsRepresentation }
        }
        return ["transactions": transactions, "renewals": renewals]
    }

    @objc func entitlements(_ call: CAPPluginCall) {
        let wanted = ids(call)
        Task { call.resolve(await current(wanted)) }
    }

    @objc func restore(_ call: CAPPluginCall) {
        let wanted = ids(call)
        Task {
            do {
                try await AppStore.sync()
            } catch StoreKitError.userCancelled {
                call.resolve(["transactions": [], "renewals": [], "cancelled": true])
                return
            } catch {
                call.reject(error.localizedDescription)
                return
            }
            call.resolve(await current(wanted))
        }
    }

    @objc func manage(_ call: CAPPluginCall) {
        Task { @MainActor in
            guard let scene = self.bridge?.viewController?.view.window?.windowScene else {
                call.reject("No window")
                return
            }
            do {
                try await AppStore.showManageSubscriptions(in: scene)
                call.resolve()
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }
}
