// Co-Heart Privacy Policy, Terms of Service, Credits & Licenses and FAQ — shown in-app in LegalSheet
// (footer links, privacy consent at sign-up). Nothing in the app opens the website for these.
//
// MASTER COPY: the YIA website page yia/src/app/(site)/co-heart/privacy/page.tsx.
// When the policy changes there, update this file too — the app copy changes with the next release.
// Copied 2026-11-25. Website-only links were turned into plain text ("Co-Heart support form" →
// the support email; opensymbols.org / arasaac.org / github.com/LDNOOBW kept as text, not links).
//
// In-app differences from the website: Privacy §5 "Service providers" is a short paragraph naming the
// providers by purpose instead of the website's table (2026-11-25). Section numbers match the website.
//
// FAQ: copied 2026-11-28 from the YIA website (MASTER COPY yia/src/features/co-heart/faq.tsx, page
// /co-heart/faq). Website-only parts turned into plain text: the "Co-Heart support form" link → the
// support email, the red-shield image → 🛡️, italics → quotes. In-app, the FAQ tab shows groups and
// questions as collapsible sections (LegalSheet); the website shows everything open.
//
// Inline **bold** is marked with double asterisks (rendered by LegalSheet).

export type LegalBlock =
  | { t: 'h3' | 'h4' | 'p'; text: string }
  | { t: 'ul' | 'ol'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][] };

export type LegalSectionKey = 'privacy' | 'terms' | 'credits' | 'faq';

export interface LegalSectionContent {
  title: string;
  blocks: LegalBlock[];
}

export const LEGAL_CONTENT: Record<LegalSectionKey, LegalSectionContent> = {
  "privacy": {
    "title": "Privacy Policy",
    "blocks": [
      {
        "t": "p",
        "text": "Co-Heart is a mobile app for guardians (parents, family members, and caregivers) supporting learners (children and young people aged 13 or older with intellectual and developmental disabilities (IDD) in their care). This policy explains what information we collect, how we use it, who we share it with, and the choices you have."
      },
      {
        "t": "h3",
        "text": "1. Who can use Co-Heart"
      },
      {
        "t": "ul",
        "items": [
          "Guardians must be 18 or older. We ask for your date of birth before you can create an account.",
          "Learners must be 13 or older. A learner’s profile is created, managed, and consented to by their guardian. Learners cannot create an account on their own, and they use the app only through the guardian’s account (“learner mode”).",
          "Co-Heart is intended for families in California, USA."
        ]
      },
      {
        "t": "p",
        "text": "By creating a learner profile, you confirm that you are the learner’s parent or legal guardian, or are otherwise authorized to consent on their behalf."
      },
      {
        "t": "h3",
        "text": "2. Information we collect"
      },
      {
        "t": "h4",
        "text": "Information about guardians (provided by you)"
      },
      {
        "t": "ul",
        "items": [
          "Full name, email address, county and photo",
          "Date of birth (to confirm you are 18 or older)",
          "Password (securely handled by our authentication provider; we never see it in plain text)",
          "A 6-digit Guardian PIN (stored only in hashed form)",
          "Optional: a Regional Support Category, your learner’s support plan as per California Regional Center service category, used to help you find families with similar needs",
          "Content you create: connection requests, messages to other guardians, community events and RSVPs, discussion posts and replies, and tutorials you create or link"
        ]
      },
      {
        "t": "h4",
        "text": "Information about learners (provided by the guardian)"
      },
      {
        "t": "ul",
        "items": [
          "First name or full name, date of birth or age, gender, county, and photo",
          "Likes, dislikes, abilities, languages, and comprehension level",
          "Schedule (classes and events) and the daily activity checklist",
          "Tutorials linked to the learner"
        ]
      },
      {
        "t": "h4",
        "text": "Information created when a learner uses the app"
      },
      {
        "t": "ul",
        "items": [
          "Activity check-offs (automatically deleted after 7 days)",
          "Mood selections",
          "Friend connections, and messages sent using pre-written phrases and picture-symbol cards (learners cannot type free text)"
        ]
      },
      {
        "t": "h4",
        "text": "Reports"
      },
      {
        "t": "ul",
        "items": [
          "When you report a discussion post or reply, an event, a guardian chat, or a guardian’s profile, we record who reported it, who it’s about, the reason you chose, and a copy of the reported content as it was at that moment (for a chat, the recent messages; for a profile, the name and photo)."
        ]
      },
      {
        "t": "h4",
        "text": "Blocks"
      },
      {
        "t": "ul",
        "items": [
          "When you block a guardian, we keep a record of who you blocked and when, so the block can be enforced. Only you (in Connections → Blocked) and Co-Heart admins can see it. The blocked guardian is not sent a notification, but while the block is in place, each of you sees the other’s guardian shown as “Guardian: Blocked” on learner cards and learner profiles. The record is deleted when you unblock them, or when either account is deleted."
        ]
      },
      {
        "t": "h4",
        "text": "What we do not collect"
      },
      {
        "t": "ul",
        "items": [
          "We do not use advertising trackers or sell data for advertising.",
          "We do not collect your precise GPS location.",
          "We do not ask for your home address or phone number.",
          "If you use Face ID / Touch ID, your device handles it. We never receive your biometric data.",
          "We do **not** collect diagnoses, medical records, or health information. The optional Regional Support Category is a general service category, not a diagnosis."
        ]
      },
      {
        "t": "h3",
        "text": "3. How we use information"
      },
      {
        "t": "p",
        "text": "We use information only to provide and improve Co-Heart, including to:"
      },
      {
        "t": "ul",
        "items": [
          "Create and secure accounts, and verify your email",
          "Show your learner their schedule, activities, tutorials, and friends",
          "Let guardians find and connect with other families (for example, by county or Regional Support Category)",
          "Generate tutorials you request using AI",
          "Keep the community safe: profanity filtering, blocking and reporting, and admin review of shared tutorials",
          "Respond to support requests and comply with the law"
        ]
      },
      {
        "t": "p",
        "text": "We do not use guardian or learner information for advertising, and we do not sell or “share” (as defined by California law) personal information."
      },
      {
        "t": "h3",
        "text": "4. Who can see your information"
      },
      {
        "t": "ul",
        "items": [
          "Other guardians see a limited preview (photo, name, county, and Regional Support Category tags) before connecting, and more once you’re connected.",
          "Learner friends and their guardians can see a short public summary of your learner’s profile.",
          "Private tutorials (including YouTube videos you link) are not shown to other families in the app.",
          "Shared tutorials you choose to publish are reviewed by Co-Heart admins, then visible to all guardians.",
          "Co-Heart admins can access information when needed to review tutorials, handle reports, and provide support."
        ]
      },
      {
        "t": "h3",
        "text": "5. Service providers"
      },
      {
        "t": "p",
        "text": "We use trusted companies to run Co-Heart: hosting, sign-in and storage (Supabase), creating AI tutorial scripts, images and narration (Anthropic, OpenAI, Google), sending account emails (Google Gmail), and playing YouTube videos which guardians link (YouTube). They receive only the information needed for their task."
      },
      {
        "t": "p",
        "text": "YouTube may show ads, and Co-Heart uses YouTube’s no-cookie mode. Guardians select YouTube links for their learner."
      },
      {
        "t": "p",
        "text": "We do not send your learner’s name, photo, or profile to AI providers when generating tutorials. Do not include personal details in the tutorial description."
      },
      {
        "t": "p",
        "text": "We may also disclose information if required by law, to protect someone’s safety, or as part of a merger or sale of the service (with notice to you)."
      },
      {
        "t": "h3",
        "text": "6. Your choices and rights"
      },
      {
        "t": "ul",
        "items": [
          "Review and update: edit your account and your learner’s profile in the app at any time.",
          "Delete: go to Account → Delete account in guardian mode. This permanently deletes your account and your learner’s profile.",
          "Reports: content you report, and content reported about you, is kept for moderation even if it is later edited or deleted, and even if either account is deleted. Reports are kept for as long as needed to review them and keep the community safe.",
          "Requests: email us at **coheartsupport@gmail.com** to access, correct, or delete information, or with any privacy question. We may need to verify your identity first."
        ]
      },
      {
        "t": "p",
        "text": "Depending on our size and activities, the California Consumer Privacy Act (CCPA/CPRA) may give you the right to know, delete, and correct personal information, and to not be discriminated against for using these rights. We honor these requests as described above. We do not sell or share personal information."
      },
      {
        "t": "p",
        "text": "We do not track you across other apps or websites, so we do not respond differently to “Do Not Track” signals."
      },
      {
        "t": "h3",
        "text": "7. Children’s privacy"
      },
      {
        "t": "p",
        "text": "We take learners’ privacy seriously. Learner profiles exist only under a guardian’s account and with the guardian’s consent. Learners cannot type free text in chat, guardian controls are protected by a PIN, and guardians can block or report other users. Guardians can also turn off messaging for their learner at any time with the “Disable Messaging” setting on their dashboard; while it’s on, the learner can’t open or send messages in any chat. A guardian may review, change, or delete their learner’s information at any time, or ask us to stop collecting it, by using the app or contacting us. Learners’ online status and activity are not shown to other users, and learner mode shows no unread-message counts."
      },
      {
        "t": "h3",
        "text": "8. Security"
      },
      {
        "t": "p",
        "text": "We use industry-standard safeguards, including encrypted connections (HTTPS), access rules that limit who can see each piece of data, hashed PINs, and secure on-device storage for sign-in information. No system is perfectly secure. Please keep your password and PIN private, and contact us right away if you suspect unauthorized access."
      },
      {
        "t": "h3",
        "text": "9. Changes to this policy"
      },
      {
        "t": "p",
        "text": "We may update this policy. If we make significant changes, we will notify you in the app or by email before they take effect. The effective date at the top shows when it was last updated."
      }
    ]
  },
  "terms": {
    "title": "Terms of Service",
    "blocks": [
      {
        "t": "p",
        "text": "By creating an account, you agree to these Terms and the Privacy Policy above."
      },
      {
        "t": "h3",
        "text": "1. Eligibility and accounts"
      },
      {
        "t": "ul",
        "items": [
          "You must be 18 or older to create a guardian account.",
          "You may add a learner only if you are their parent or legal guardian, or are authorized to act for them.",
          "You are responsible for your account, password, and Guardian PIN, and for all activity under your account, including your learner’s activity in learner mode.",
          "Give accurate information and keep it up to date."
        ]
      },
      {
        "t": "h3",
        "text": "2. Supervising your learner"
      },
      {
        "t": "p",
        "text": "Co-Heart includes safety features, but it does not replace adult supervision. You are responsible for deciding whether Co-Heart is appropriate for your learner, supervising their use, and managing their friends and chats."
      },
      {
        "t": "h3",
        "text": "3. Community rules"
      },
      {
        "t": "p",
        "text": "When using Co-Heart, you agree not to:"
      },
      {
        "t": "ul",
        "items": [
          "Harass, bully, threaten, or discriminate against anyone",
          "Post content that is sexual, violent, hateful, illegal, or otherwise inappropriate, especially content involving learners",
          "Contact learners without the involvement of their guardian, or try to get learners’ personal information",
          "Pretend to be someone else, or create accounts for people you’re not authorized to represent",
          "Post spam, ads, or misleading information",
          "Interfere with the app, bypass its safety or review features, access data that isn’t yours, or misuse our systems (for example, by calling our servers outside the app to get around limits)"
        ]
      },
      {
        "t": "p",
        "text": "Co-Heart has zero tolerance for objectionable content and abusive users. We review reports within 24 hours and remove content that breaks these rules, and may suspend or permanently remove the accounts responsible."
      },
      {
        "t": "p",
        "text": "We may remove content, limit features, or suspend or close accounts that break these rules. Please report concerns in the app or by email to **coheartsupport@gmail.com**."
      },
      {
        "t": "h3",
        "text": "4. Your content"
      },
      {
        "t": "p",
        "text": "You keep ownership of what you post (for example, discussion posts, events, and tutorials you create). If you share a tutorial with other guardians, you also allow other guardians to view it and use it with their learners for as long as it remains in the shared library. You confirm you have the rights to anything you post or link."
      },
      {
        "t": "h3",
        "text": "5. AI-generated tutorials"
      },
      {
        "t": "ul",
        "items": [
          "Tutorials are created with AI and may contain mistakes. Review every tutorial before your learner uses it.",
          "Tutorials are general educational aids. They are not medical, therapeutic, behavioral, or professional advice, and do not replace guidance from your learner’s doctors, therapists, teachers, or Regional Center.",
          "Shared tutorials are reviewed by our team before appearing in the shared library. Approval does not guarantee accuracy or suitability for every learner.",
          "AI tutorial creation has a monthly limit, which we may change."
        ]
      },
      {
        "t": "h3",
        "text": "6. YouTube and third-party content"
      },
      {
        "t": "p",
        "text": "Linked YouTube videos are provided by YouTube and subject to the YouTube Terms of Service . YouTube may collect data and may show ads under its own policies when a video plays. We use YouTube’s privacy-enhanced (no-cookie) mode. We do not control or endorse third-party content."
      },
      {
        "t": "h3",
        "text": "7. Community events and resources"
      },
      {
        "t": "p",
        "text": "Events and discussions are posted by guardians. Co-Heart does not organize, verify, or supervise events and is not responsible for them. Use your own judgment when meeting others or attending events. Resources are for general information only."
      },
      {
        "t": "h3",
        "text": "8. Features"
      },
      {
        "t": "p",
        "text": "Features may change, be unavailable, or contain bugs, and data may occasionally need to be reset during testing. We may change, pause, or stop the service at any time."
      },
      {
        "t": "h3",
        "text": "9. Disclaimers"
      },
      {
        "t": "p",
        "text": "Co-Heart is provided “as is” and “as available,” without warranties of any kind to the extent permitted by law. We do not guarantee that the app will be error-free, uninterrupted, or secure, or that content (including AI tutorials) will be accurate."
      },
      {
        "t": "h3",
        "text": "10. Limitation of liability"
      },
      {
        "t": "p",
        "text": "To the fullest extent permitted by law, Co-Heart and its operators are not liable for indirect, incidental, special, or consequential damages, or for losses arising from user content, interactions between users, or events."
      },
      {
        "t": "h3",
        "text": "11. Ending your account"
      },
      {
        "t": "p",
        "text": "You can delete your account at any time in Account → Delete account. We may suspend or close accounts that violate these Terms or put others at risk. Sections that by their nature should continue (such as disclaimers and limitation of liability) survive after your account ends."
      },
      {
        "t": "h3",
        "text": "12. Changes to these Terms"
      },
      {
        "t": "p",
        "text": "We may update these Terms. If changes are significant, we’ll notify you in the app or by email. Continuing to use Co-Heart after changes take effect means you accept them."
      },
      {
        "t": "h3",
        "text": "13. Governing law"
      },
      {
        "t": "p",
        "text": "These Terms are governed by the laws of the State of California, without regard to conflict-of-law rules. Disputes will be handled in the state or federal courts located in California, unless the law requires otherwise."
      },
      {
        "t": "h3",
        "text": "14. Apple App Store"
      },
      {
        "t": "p",
        "text": "If you downloaded Co-Heart from the App Store, these Terms are between you and us, not Apple. Apple is not responsible for the app or its content and has no obligation to provide support. Apple and its subsidiaries are third-party beneficiaries of these Terms and may enforce them."
      },
      {
        "t": "h3",
        "text": "15. Contact"
      },
      {
        "t": "p",
        "text": "Questions about these Terms or the Privacy Policy: email **coheartsupport@gmail.com**"
      }
    ]
  },
  "credits": {
    "title": "Credits & Licenses",
    "blocks": [
      {
        "t": "p",
        "text": "Co-Heart uses the following third-party content and open-source software. We thank their creators."
      },
      {
        "t": "h3",
        "text": "Picture symbols (learner chat)"
      },
      {
        "t": "p",
        "text": "The picture symbols learners use to chat are ARASAAC pictograms (obtained via OpenSymbols, opensymbols.org). The pictographic symbols are the property of the Government of Aragón and were created by Sergio Palao for ARASAAC (arasaac.org), which distributes them under a Creative Commons BY-NC-SA license. They are shown unmodified."
      },
      {
        "t": "h3",
        "text": "Content filtering"
      },
      {
        "t": "p",
        "text": "To help keep conversations kind, Co-Heart checks text against lists of inappropriate words:"
      },
      {
        "t": "ul",
        "items": [
          "bad-words and its word list badwords-list, by Michael Price, MIT License.",
          "“List of Dirty, Naughty, Obscene, and Otherwise Bad Words” by Shutterstock, licensed under CC BY 4.0 (github.com/LDNOOBW)."
        ]
      },
      {
        "t": "p",
        "text": "These lists are used only to block words. They are never shown to users."
      },
      {
        "t": "h3",
        "text": "Videos, images and narration"
      },
      {
        "t": "ul",
        "items": [
          "YouTube videos linked by guardians are shown through YouTube’s embedded player and are subject to the YouTube Terms of Service. YouTube and its videos belong to their respective owners.",
          "AI tutorial images are created with OpenAI’s image models, and narration audio is created with Google Cloud Text-to-Speech."
        ]
      },
      {
        "t": "h3",
        "text": "Open-source software"
      },
      {
        "t": "p",
        "text": "Co-Heart is built with open-source software, including React Native and Expo (MIT License) and the Supabase client libraries (MIT License). A full list of open-source components and their licenses is available on request by email to **coheartsupport@gmail.com**."
      },
      {
        "t": "p",
        "text": "All trademarks belong to their respective owners."
      }
    ]
  },
  "faq": {
    "title": "Frequently Asked Questions",
    "blocks": [
      {
        "t": "h3",
        "text": "Getting started"
      },
      {
        "t": "h4",
        "text": "Who is Co-Heart for?"
      },
      {
        "t": "p",
        "text": "Two people share the app:"
      },
      {
        "t": "ul",
        "items": [
          "**Guardians**: parents, family members, or caregivers (18 or older) who set up and manage a learner’s account. Guardians create the learner’s profile, plan their weekly schedule and daily activities, choose or create tutorials for them, and approve their friends and chats. Guardians can also connect with other families nearby, join community events, and take part in discussions.",
          "**Learners**: the child or young person with IDD, aged 13 or older, that the guardian supports. In Co-Heart we call them the “learner.” Learners get their own simple view with large buttons, where they see today’s schedule, tick off their daily activities (like brushing teeth or packing a bag), and learn new skills from short tutorials: narrated step-by-step slideshows or videos chosen by their guardian. They can also chat with friends using picture symbols and ready-made phrases, with no open typing."
        ]
      },
      {
        "t": "h4",
        "text": "Where can I get the app?"
      },
      {
        "t": "p",
        "text": "Co-Heart will be available for iPhone. If you’d like to know when it’s ready, email us at **coheartsupport@gmail.com**."
      },
      {
        "t": "h4",
        "text": "Is there an Android version?"
      },
      {
        "t": "p",
        "text": "Not yet. Co-Heart is for iPhone only for now."
      },
      {
        "t": "h4",
        "text": "Who can use Co-Heart?"
      },
      {
        "t": "p",
        "text": "Co-Heart is built for families in California."
      },
      {
        "t": "h3",
        "text": "Accounts & signing in"
      },
      {
        "t": "h4",
        "text": "How do I create an account?"
      },
      {
        "t": "p",
        "text": "Guardians sign up in the app. You’ll:"
      },
      {
        "t": "ol",
        "items": [
          "Agree to the Privacy Policy and Terms of Service, then confirm you’re 18 or older.",
          "Enter your name, email, county, and a password.",
          "Choose a 6-digit Guardian PIN.",
          "Enter the 6-digit code we email you to verify your address."
        ]
      },
      {
        "t": "h4",
        "text": "What are the password rules?"
      },
      {
        "t": "p",
        "text": "At least 6 characters, including at least one uppercase letter, one lowercase letter, and one number."
      },
      {
        "t": "h4",
        "text": "I didn’t get the verification or reset email."
      },
      {
        "t": "ul",
        "items": [
          "Check your spam or junk folder.",
          "Wait a minute or two and use **Resend code**.",
          "Make sure the email address is spelled correctly.",
          "Codes expire after a short time, so use the newest one you received."
        ]
      },
      {
        "t": "h4",
        "text": "I forgot my password."
      },
      {
        "t": "p",
        "text": "On the sign-in screen, tap **Forgot password?**, enter your email, and type in the 6-digit code we send you. You can then choose a new password."
      },
      {
        "t": "h4",
        "text": "Does my learner need their own account?"
      },
      {
        "t": "p",
        "text": "The guardian creates the learner’s profile. From then on, the guardian switches the app into learner mode and hands the device over, so the learner doesn’t need to remember a password."
      },
      {
        "t": "h3",
        "text": "Guardian mode, learner mode & the PIN"
      },
      {
        "t": "h4",
        "text": "How do I switch between guardian and learner mode?"
      },
      {
        "t": "p",
        "text": "After signing in, you’ll see two options:"
      },
      {
        "t": "ul",
        "items": [
          "**Mentor & Connect**: guardian mode, where you manage everything. This needs your Guardian PIN.",
          "**Grow & Connect**: learner mode, the simplified experience for your learner."
        ]
      },
      {
        "t": "h4",
        "text": "What is the Guardian PIN for?"
      },
      {
        "t": "p",
        "text": "The PIN keeps guardian controls away from your learner. You need it to:"
      },
      {
        "t": "ul",
        "items": [
          "Enter guardian mode.",
          "Block, report, or delete a chat from inside your learner’s chat screen."
        ]
      },
      {
        "t": "h4",
        "text": "I forgot my Guardian PIN."
      },
      {
        "t": "p",
        "text": "On the PIN screen, tap **Forgot PIN?**, enter your account password, and choose a new 6-digit PIN."
      },
      {
        "t": "h3",
        "text": "Your learner"
      },
      {
        "t": "h4",
        "text": "What can I set up for my learner?"
      },
      {
        "t": "p",
        "text": "Their profile (name, birthday, photo, county, likes, dislikes, abilities, languages, and comprehension level), their weekly schedule, their daily activities, their tutorials, and their friends."
      },
      {
        "t": "h4",
        "text": "Can my learner see or change their own profile?"
      },
      {
        "t": "p",
        "text": "No. Learner profiles are fully managed by the guardian."
      },
      {
        "t": "h4",
        "text": "Can I add more than one learner?"
      },
      {
        "t": "p",
        "text": "No. Each guardian account has one learner. If your family has more than one learner with IDD, create a separate guardian account for each learner, using a different email address."
      },
      {
        "t": "h4",
        "text": "Can my learner block another learner?"
      },
      {
        "t": "p",
        "text": "No, learners can never block anyone. Only a guardian can, on behalf of their own learner."
      },
      {
        "t": "h4",
        "text": "How do I block a learner?"
      },
      {
        "t": "p",
        "text": "From the learner’s chat: 🛡️ red shield → 6-digit Guardian PIN → 🚫 **Block User**, with an optional reason, then confirm."
      },
      {
        "t": "h4",
        "text": "Why can I only block a learner from the chat?"
      },
      {
        "t": "p",
        "text": "Chat is the only place learners interact, so that’s where a reason to block comes from. That’s why there’s no Block button on learner cards or profiles."
      },
      {
        "t": "h4",
        "text": "What happens when I block a learner?"
      },
      {
        "t": "ul",
        "items": [
          "They’re hidden from your learner’s friends list and from Find Friends.",
          "Your learner can’t chat with them.",
          "The other family isn’t sent a notification.",
          "Other friendships aren’t affected, and blocking a learner doesn’t block their guardian."
        ]
      },
      {
        "t": "h4",
        "text": "Where can I see or undo a block?"
      },
      {
        "t": "p",
        "text": "**Manage Friends → Blocked**, which shows the reason, with **Unblock**."
      },
      {
        "t": "h3",
        "text": "Schedule & daily activities"
      },
      {
        "t": "h4",
        "text": "How does the schedule work?"
      },
      {
        "t": "p",
        "text": "Add recurring weekly classes (day, time, and date range) or one-time events. You can cancel a single class without removing the whole series. Your learner sees today’s schedule on their home screen, color-coded as happening now, coming up, or finished."
      },
      {
        "t": "h4",
        "text": "What are daily activities?"
      },
      {
        "t": "p",
        "text": "A checklist your learner ticks off each day, with things like brushing teeth or packing a bag. Pick up to 10 activities from the preset list."
      },
      {
        "t": "h4",
        "text": "Can I see whether my learner completed their activities?"
      },
      {
        "t": "p",
        "text": "Yes. The activities report shows the last 7 days. Older activity history is deleted automatically."
      },
      {
        "t": "h3",
        "text": "Tutorials"
      },
      {
        "t": "h4",
        "text": "What are tutorials?"
      },
      {
        "t": "p",
        "text": "Short lessons that teach a skill step by step. Learners watch them as a narrated, auto-advancing slideshow or as a video."
      },
      {
        "t": "h4",
        "text": "What kinds of tutorials can I add?"
      },
      {
        "t": "ul",
        "items": [
          "**AI-generated tutorials**: describe the skill and the main action, and Co-Heart creates an illustrated slideshow for you.",
          "**YouTube videos**: link any public YouTube video.",
          "**Library tutorials**: browse tutorials other guardians have made that our team has approved, and add them for your learner."
        ]
      },
      {
        "t": "h4",
        "text": "Do AI-generated tutorials need to be approved?"
      },
      {
        "t": "p",
        "text": "Only if you share them. When you create a tutorial, you choose whether to **Share with other guardians**:"
      },
      {
        "t": "ul",
        "items": [
          "**Not shared (private)**: ready to use as soon as it’s generated, with no review needed. Private tutorials don’t appear in the shared library and aren’t shown to other families.",
          "**Shared (public)**: after it’s generated, preview it and tap **Submit for Review**. The Co-Heart team checks it before it appears in the shared library for all guardians. You’ll get a notification when it’s approved or if it needs changes, and you can withdraw it from review at any time."
        ]
      },
      {
        "t": "h4",
        "text": "Is there a limit on AI-generated tutorials?"
      },
      {
        "t": "p",
        "text": "Yes, each guardian can create a limited number per month (currently 10). The count resets at the start of each month."
      },
      {
        "t": "h4",
        "text": "How long are AI-generated tutorials, and what language are they in?"
      },
      {
        "t": "p",
        "text": "AI-generated tutorials are always in **English** and run about 30–40 seconds: a few short slides, each with a simple caption and spoken narration."
      },
      {
        "t": "h4",
        "text": "Can other families see the YouTube videos I link?"
      },
      {
        "t": "p",
        "text": "No. Linked YouTube videos are private: only you and your learner can see them."
      },
      {
        "t": "h4",
        "text": "Will my learner see ads in YouTube videos?"
      },
      {
        "t": "p",
        "text": "Co-Heart never shows ads. But YouTube videos are played by YouTube, and YouTube may show ads before or during some videos. We play them in YouTube’s privacy-enhanced mode to limit tracking. To avoid ads, choose videos from channels that don’t run ads, or use AI-generated tutorials, which never have ads."
      },
      {
        "t": "h4",
        "text": "Something went wrong generating my tutorial. What should I do?"
      },
      {
        "t": "p",
        "text": "Email us at **coheartsupport@gmail.com** and let us know which tutorial it was."
      },
      {
        "t": "h3",
        "text": "Friends & chat"
      },
      {
        "t": "h4",
        "text": "How does my learner make friends?"
      },
      {
        "t": "p",
        "text": "You manage your learner’s friends: review and accept friend requests, and search for other learners to connect with. Before connecting, you can see a short public profile, including the other learner’s guardian."
      },
      {
        "t": "h4",
        "text": "Can my learner type messages freely?"
      },
      {
        "t": "p",
        "text": "No. To keep chat safe, learners communicate using pre-written phrases and picture-symbol cards (a communication board), not open typing. A profanity filter also checks every message as an extra safeguard."
      },
      {
        "t": "h4",
        "text": "Can I turn off messaging for my learner?"
      },
      {
        "t": "p",
        "text": "Yes. On your dashboard, in your learner’s zone, switch on “Disable Messaging” (tap **ⓘ** next to it for details). While it’s on, your learner can’t open or send messages in any of their friend chats. Their friends list stays as it is, and you can switch messaging back on at any time."
      },
      {
        "t": "h4",
        "text": "What can I do if someone bothers my learner?"
      },
      {
        "t": "p",
        "text": "Open your learner’s chat with that person and tap the 🛡️ red shield at the top of the screen. Enter your 6-digit Guardian PIN (it continues automatically once all 6 digits are entered), then choose an action:"
      },
      {
        "t": "ul",
        "items": [
          "🗑️ **Delete Chat**: removes the conversation.",
          "🚫 **Block User**: removes them from your learner’s friends list. You can unblock them later from the Learner’s Friends page.",
          "📢 **Report User**: sends a report to our team, who will review it within 24 hours. They stay your learner’s friend unless you also block them."
        ]
      },
      {
        "t": "p",
        "text": "The PIN keeps these controls away from your learner. If you need help, email us at **coheartsupport@gmail.com**."
      },
      {
        "t": "h3",
        "text": "Connecting with other guardians"
      },
      {
        "t": "h4",
        "text": "Can I connect with other guardians?"
      },
      {
        "t": "p",
        "text": "Yes. Use the **Find** tab to search by name, county, or Regional Support Category, send a connection request, and message guardians once you’re connected. Before connecting, you’ll only see a short preview (photo, name, county, and category tags)."
      },
      {
        "t": "h4",
        "text": "Can I see other guardians’ phone numbers or addresses?"
      },
      {
        "t": "p",
        "text": "No. Co-Heart doesn’t ask for anyone’s phone number or home address, so they’re never shown in the app. If you’d like to stay in touch or meet up, connect with the guardian and message them in the app to share details yourselves."
      },
      {
        "t": "h4",
        "text": "What else is in the community section?"
      },
      {
        "t": "ul",
        "items": [
          "**Events**: browse or create community events and RSVP - tap Going to RSVP (tap again to cancel).",
          "**Discussions**: post topics and reply to other guardians. You can edit or delete your own posts.",
          "**Resources**: helpful information and support links."
        ]
      },
      {
        "t": "h4",
        "text": "How do I report something?"
      },
      {
        "t": "p",
        "text": "Tap the 🚩 on the item, choose a reason (Offensive, Spam, Harassment, or Sensitive), and tap **Report**. You can report:"
      },
      {
        "t": "ul",
        "items": [
          "a discussion post or reply",
          "an event (open it from the Events list)",
          "a guardian chat (🚩 at the top of the chat)",
          "a guardian’s profile (on their profile card or in Connections)"
        ]
      },
      {
        "t": "p",
        "text": "Our team reviews every report within 24 hours. The person you report is not told who reported them. You can’t report your own content, and each item can be reported once — after that the 🚩 is dimmed and shows **Already Reported**. For anything urgent, email us at **coheartsupport@gmail.com**."
      },
      {
        "t": "p",
        "text": "To report someone in your learner’s chat, use the guardian controls inside that chat (see “What can I do if someone bothers my learner?”)."
      },
      {
        "t": "h4",
        "text": "How do I block a guardian?"
      },
      {
        "t": "p",
        "text": "Tap 🚫 next to their name (on their profile card, at the top of your chat, or on their card in Connections), then tap **Block**. You won’t see each other’s posts, events, or profile, and you can’t message each other. Your connection and any RSVPs between you are removed. They aren’t told. You aren’t sent a notification about a block, but on learner cards and profiles, each of you will see the other’s guardian shown as “Guardian: Blocked”."
      },
      {
        "t": "p",
        "text": "Your learners’ friendship isn’t affected."
      },
      {
        "t": "h4",
        "text": "How do I unblock someone?"
      },
      {
        "t": "p",
        "text": "Go to **Connections → Blocked** and tap **Unblock**. You won’t be reconnected; send a new request if you’d like to connect again."
      },
      {
        "t": "h3",
        "text": "Privacy, safety & your data"
      },
      {
        "t": "h4",
        "text": "Who can see my learner’s information?"
      },
      {
        "t": "p",
        "text": "Your learner’s full profile is visible to you. Other families see only a short public summary when your learners are friends or are considering connecting."
      },
      {
        "t": "h4",
        "text": "How long is data kept?"
      },
      {
        "t": "p",
        "text": "Activity check-off history is kept for 7 days, then deleted automatically. Other information stays until you change or delete it."
      },
      {
        "t": "h4",
        "text": "How do I delete my account?"
      },
      {
        "t": "p",
        "text": "In guardian mode, go to **Account → Delete account**. This permanently deletes your account and your learner’s profile, and can’t be undone."
      },
      {
        "t": "h3",
        "text": "Help & feedback"
      },
      {
        "t": "h4",
        "text": "How do I contact support?"
      },
      {
        "t": "p",
        "text": "Email us at **coheartsupport@gmail.com**."
      },
      {
        "t": "h4",
        "text": "I found a bug. Where do I report it?"
      },
      {
        "t": "p",
        "text": "Email us at **coheartsupport@gmail.com**. Tell us what you were doing, what you expected, and what happened."
      }
    ]
  }
};
