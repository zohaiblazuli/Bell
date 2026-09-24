# Claude.ai greeting messages

The greetings claude.ai shows above the prompt box on its home screen, and when each one is shown. Collected as a reference for Bell's own greetings.

## How a greeting is chosen

1. **Hour**, in the user's local time:
   - Morning: 06:00–12:00
   - Afternoon: 12:00–17:00
   - Evening: 17:00–21:00
   - Late night: 21:00–06:00, running past midnight
2. **Day of week.** Some greetings only appear on certain days. The rest can appear on any day.
3. **Name.** If the user's name is known, the `{name}` version is used. Otherwise the nameless version is used.
4. **Random pick** from every greeting that matches the hour and day, so reloading can change it.
5. **Incognito chat** ignores all of the above and uses its own greeting.

## Greetings

| # | With name | Without name | Hours | Days |
|---|---|---|---|---|
| 1 | Good morning, {name} | Good morning | 06–12 | Any |
| 2 | Welcome, {name} | Welcome | 06–12 | Any |
| 3 | Hey there, {name} | Hey there | 06–12 | Any |
| 4 | — | Coffee and Claude time? | 06–12 | Any |
| 5 | Happy Monday, {name} | Happy Monday | 06–12 | Monday |
| 6 | Happy Tuesday, {name} | Happy Tuesday | 06–12 | Tuesday |
| 7 | Happy Wednesday, {name} | Happy Wednesday | 06–12 | Wednesday |
| 8 | Happy Thursday, {name} | Happy Thursday | 06–12 | Thursday |
| 9 | Happy Friday, {name} | Happy Friday | 06–12 | Friday |
| 10 | That Friday feeling, {name} | That Friday feeling | 06–12 | Friday |
| 11 | Welcome to the weekend, {name} | Welcome to the weekend | 06–12 | Saturday, Sunday |
| 12 | What's on your mind, {name}? | — | 06–12 | Saturday, Sunday |
| 13 | Happy Saturday, {name} | Happy Saturday! | 06–12 | Saturday |
| 14 | Sunday session, {name}? | Sunday session? | 06–12 | Sunday |
| 15 | Happy Sunday, {name} | Happy Sunday | 06–12 | Sunday |
| 16 | Good afternoon, {name} | Good afternoon | 12–17 | Any |
| 17 | Hi {name}, how are you? | Hi, how are you? | 12–17 | Any |
| 18 | What's new, {name}? | What's new? | 12–17 | Any |
| 19 | Back at it, {name} | Back at it! | 12–17 | Any |
| 20 | {name} returns! | Back at it! | 17–21 | Any |
| 21 | Good evening, {name} | Good evening | 17–21 | Any |
| 22 | Evening, {name} | Evening | 17–21 | Any |
| 23 | How was your day, {name}? | How was your day? | 17–21 | Any |
| 24 | How's it going, {name}? | How's it going? | 21–06 | Any |
| 25 | — | What's on your mind tonight? | 21–06 | Any |
| 26 | — | Hello, night owl | 21–06 | Any |

A dash (—) means no variant of that kind has been seen.

### Special cases

| Greeting | When it's shown |
|---|---|
| Greetings, whoever you are | Incognito chat is on (ghost icon, or Ctrl+Shift+I) |
| Let's chat incognito | Incognito chat screen |
| Afternoon, {name} | Afternoon. Seen in a 2026 screenshot but missing from the scraped list, so it was probably added later |

## Caveats

- The scraped list is a snapshot of one version of claude.ai, and greetings are added over time.
- The scraped data puts "{name} returns!" in the evening window. One user reported seeing it after a few days away, so there may also be a rule for returning users. This is unconfirmed.
- Whether a boundary hour like 12:00 belongs to the earlier or the later window is not known.
- Where the nameless column isn't a scraped string, it is the named greeting with the name taken out. "Happy Saturday!" and "Back at it!" are spelled as scraped.

## Sources

- [Claude greetings scraped from claude.ai's JS files (gist)](https://gist.github.com/Posandu/e97d3cd20a671749ce7162a2a4f51fee): text, hours and days
- ["Here's every single Claude greeting", @dwlz](https://x.com/dwlz/status/1965495158025114097): nameless and incognito variants
- [Dan Gingiss on LinkedIn](https://www.linkedin.com/posts/dangingiss_customerexperience-userexperience-genai-activity-7356332833872728065-PUyx): "Dan Returns!" after a few days away
- [Thoughts Brewing: Temporary chats in Claude](https://thoughtsbrewing.com/blog/ai-quick-tips-298-temporary-chats-in-claude): incognito greeting, "Afternoon, {name}"
