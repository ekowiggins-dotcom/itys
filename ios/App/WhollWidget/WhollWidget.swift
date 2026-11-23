import WidgetKit
import SwiftUI

/// What the widget shows. Counts and a time only: no call text, so nothing personal sits on a lock screen.
struct Summary: Codable {
    let needsYou: Int
    let openCalls: Int
    let nextLockAt: String?
}

struct Entry: TimelineEntry {
    let date: Date
    let summary: Summary?
    let signedIn: Bool

    var nextLock: Date? {
        guard let s = summary?.nextLockAt else { return nil }
        let f = ISO8601DateFormatter()
        f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }
}

struct Provider: TimelineProvider {
    private var defaults: UserDefaults? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "WhollAppGroup") as? String else { return nil }
        return UserDefaults(suiteName: group)
    }

    func placeholder(in context: Context) -> Entry {
        Entry(date: Date(), summary: Summary(needsYou: 1, openCalls: 3, nextLockAt: nil), signedIn: true)
    }

    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        fetch { completion($0) }
    }

    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        fetch { entry in
            // Refresh every 15 minutes; WidgetKit may stretch this to save battery.
            completion(Timeline(entries: [entry], policy: .after(Date().addingTimeInterval(15 * 60))))
        }
    }

    /// GET {baseUrl}/api/widget with the read-only widget token the app stored in the App Group.
    private func fetch(_ done: @escaping (Entry) -> Void) {
        guard let token = defaults?.string(forKey: "widgetToken"),
              let base = defaults?.string(forKey: "baseUrl"),
              let url = URL(string: base + "/api/widget") else {
            done(Entry(date: Date(), summary: nil, signedIn: false))
            return
        }
        var request = URLRequest(url: url)
        request.setValue("Bearer \(token)", forHTTPHeaderField: "Authorization")
        request.timeoutInterval = 10
        URLSession.shared.dataTask(with: request) { data, response, _ in
            let ok = (response as? HTTPURLResponse)?.statusCode == 200
            let summary = ok ? data.flatMap { try? JSONDecoder().decode(Summary.self, from: $0) } : nil
            let signedIn = (response as? HTTPURLResponse)?.statusCode != 401
            done(Entry(date: Date(), summary: summary, signedIn: signedIn))
        }.resume()
    }
}

struct WhollWidgetView: View {
    let entry: Entry

    var body: some View {
        VStack(alignment: .leading, spacing: 6) {
            Text("Who’ll").font(.headline).foregroundStyle(.green)
            if !entry.signedIn {
                Text("Open the app to sign in").font(.caption).foregroundStyle(.secondary)
            } else if let s = entry.summary {
                if s.needsYou > 0 {
                    Text("\(s.needsYou) need\(s.needsYou == 1 ? "s" : "") you").font(.title3).bold()
                }
                Text("\(s.openCalls) open call\(s.openCalls == 1 ? "" : "s")").font(.subheadline)
                if let next = entry.nextLock {
                    Text("Next closes \(next, style: .relative)").font(.caption).foregroundStyle(.secondary)
                }
            } else {
                Text("Can’t update right now").font(.caption).foregroundStyle(.secondary)
            }
            Spacer(minLength: 0)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity, alignment: .topLeading)
        .widgetURL(URL(string: "wholl://open"))
    }
}

@main
struct WhollWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "WhollWidget", provider: Provider()) { entry in
            if #available(iOSApplicationExtension 17.0, *) {
                WhollWidgetView(entry: entry).containerBackground(.fill.tertiary, for: .widget)
            } else {
                WhollWidgetView(entry: entry).padding()
            }
        }
        .configurationDisplayName("Who’ll")
        .description("Calls that need you and when picks close next.")
        .supportedFamilies([.systemSmall, .accessoryRectangular])
    }
}
