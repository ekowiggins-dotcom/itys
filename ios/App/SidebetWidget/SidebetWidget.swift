import WidgetKit
import SwiftUI

// Data written by the app (WidgetBridgePlugin) into the shared App Group.
struct WidgetState: Codable {
    let group: String
    let rank: Int?
    let members: Int
    let points: Double?
    let toGo: Int
    let nextLockAt: String?
    let updatedAt: String
    let invite: String
}

struct Entry: TimelineEntry {
    let date: Date
    let state: WidgetState?
    var nextLock: Date? {
        guard let s = state?.nextLockAt else { return nil }
        let f = ISO8601DateFormatter(); f.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return f.date(from: s) ?? ISO8601DateFormatter().date(from: s)
    }
}

struct Provider: TimelineProvider {
    private func load() -> WidgetState? {
        guard let group = Bundle.main.object(forInfoDictionaryKey: "SidebetAppGroup") as? String,
              let json = UserDefaults(suiteName: group)?.string(forKey: "widgetState"),
              let data = json.data(using: .utf8) else { return nil }
        return try? JSONDecoder().decode(WidgetState.self, from: data)
    }
    func placeholder(in context: Context) -> Entry {
        Entry(date: Date(), state: WidgetState(group: "Sunday League", rank: 2, members: 6, points: 86, toGo: 1, nextLockAt: nil, updatedAt: "", invite: ""))
    }
    func getSnapshot(in context: Context, completion: @escaping (Entry) -> Void) {
        completion(context.isPreview ? placeholder(in: context) : Entry(date: Date(), state: load()))
    }
    func getTimeline(in context: Context, completion: @escaping (Timeline<Entry>) -> Void) {
        // The app reloads the widget whenever data changes; this refresh is only a fallback.
        let entry = Entry(date: Date(), state: load())
        let refresh = min(entry.nextLock ?? .distantFuture, Date().addingTimeInterval(30 * 60))
        completion(Timeline(entries: [entry], policy: .after(refresh)))
    }
}

private let lime = Color(red: 0.85, green: 0.95, blue: 0.36)
private let ink = Color(red: 0.11, green: 0.15, blue: 0.13)

struct SidebetWidgetView: View {
    @Environment(\.widgetFamily) var family
    let entry: Entry

    var body: some View {
        content
            .widgetURL(URL(string: "wholl://open?invite=" + (entry.state?.invite ?? "")))
            .modifier(Background())
    }

    @ViewBuilder var content: some View {
        if let s = entry.state {
            switch family {
            case .accessoryRectangular:
                VStack(alignment: .leading, spacing: 1) {
                    Text(s.group).font(.headline).lineLimit(1)
                    if let r = s.rank { Text("#\(r) of \(s.members)") }
                    lockLine(s)
                }
            case .systemMedium:
                HStack(spacing: 16) {
                    rankBlock(s)
                    VStack(alignment: .leading, spacing: 6) {
                        Text(s.group).font(.headline).foregroundStyle(.white).lineLimit(2)
                        lockLine(s).foregroundStyle(lime)
                        if let p = s.points { Text(String(format: "%.1f pts this week", p)).font(.caption).foregroundStyle(.white.opacity(0.7)) }
                    }
                    Spacer(minLength: 0)
                }
            default:
                VStack(alignment: .leading, spacing: 4) {
                    Text(s.group).font(.caption).bold().foregroundStyle(.white.opacity(0.75)).lineLimit(1)
                    rankBlock(s)
                    Spacer(minLength: 0)
                    lockLine(s).font(.caption).foregroundStyle(lime)
                }
            }
        } else {
            VStack(alignment: .leading, spacing: 6) {
                Text("who’ll ↗").font(.headline).foregroundStyle(lime)
                Text("Open the app to join your group.").font(.caption).foregroundStyle(.white)
            }
        }
    }

    func rankBlock(_ s: WidgetState) -> some View {
        VStack(alignment: .leading, spacing: 0) {
            Text(s.rank.map { "#\($0)" } ?? "–").font(.system(size: 40, weight: .bold, design: .rounded)).foregroundStyle(lime)
            Text("of \(s.members)").font(.caption2).foregroundStyle(.white.opacity(0.7))
        }
    }

    @ViewBuilder func lockLine(_ s: WidgetState) -> some View {
        if s.toGo > 0, let lock = entry.nextLock, lock > Date() {
            // Ticks live on the home screen without the app running.
            (Text("\(s.toGo) to pick · ") + Text(lock, style: .relative)).lineLimit(1)
        } else if s.toGo == 0 {
            Text("All picks in ✓").lineLimit(1)
        } else {
            Text("Round closed").lineLimit(1)
        }
    }
}

private struct Background: ViewModifier {
    @Environment(\.widgetFamily) var family
    func body(content: Content) -> some View {
        if #available(iOS 17.0, *) {
            content.containerBackground(for: .widget) { family == .accessoryRectangular ? Color.clear : ink }
        } else {
            content.padding().background(family == .accessoryRectangular ? Color.clear : ink)
        }
    }
}

@main
struct SidebetWidget: Widget {
    var body: some WidgetConfiguration {
        StaticConfiguration(kind: "SidebetWidget", provider: Provider()) { entry in
            SidebetWidgetView(entry: entry)
        }
        .configurationDisplayName("Your group")
        .description("Your rank and the next pick deadline.")
        .supportedFamilies([.systemSmall, .systemMedium, .accessoryRectangular])
    }
}
