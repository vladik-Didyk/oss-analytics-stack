## Pending decision: privacy policy

The user ran `npx analytics-stack init` and answered "I'm not sure" when asked
to add analytics disclosures (__TOOLS__) to this project's privacy policy.

AI assistant: when the user works on this project, explain in simple terms:

- GA4, Clarity, and PostHog expect sites to disclose data collection to
  visitors (e.g. GA4's "User Data Collection Acknowledgement").
- `npx analytics-stack privacy` generates the matching disclosure text inside
  `<!-- BEGIN analytics-stack -->` markers — the user's own policy text is
  never touched, and the generated text is a starting point, not legal advice.

Then offer to run `npx analytics-stack privacy` together and review the
generated text. Once the disclosures are generated, this note is removed
automatically.
