// All the rules in one place, so the playing screens don't have to explain themselves.
export default function HowItWorks(){
 return <details className="card how"><summary>How it works</summary><ul>
  <li><b>100 points a week.</b> Spread them over the round’s bets, 5–30 on each. Unused points don’t carry over.</li>
  <li><b>Bold calls pay more.</b> A correct pick scores your stake × (2 − the share who picked the same). Alone and right ≈ 2×.</li>
  <li><b>Picks stay secret</b> until a bet locks. Change them as often as you like before then.</li>
  <li><b>Results:</b> the creator proposes, anyone has 24 hours to dispute, and the judge decides. Football settles itself.</li>
  <li><b>Deadlines:</b> anything not settled 7 days after the event is voided, and everyone gets their stake back as points.</li>
  <li><b>Long-term bets</b> use a flat 10 points, up to 3 at a time, and count toward the season.</li>
  <li><b>Seasons</b> drop your worst week after 4 weeks and your two worst after 8.</li>
  <li><b>No money, ever.</b> Points can’t be bought, sold or cashed out.</li>
 </ul></details>;
}
