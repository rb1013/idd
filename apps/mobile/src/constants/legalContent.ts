// Co-Heart Privacy Policy, Terms of Service and Credits & Licenses — shown in-app in LegalSheet
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
// Inline **bold** is marked with double asterisks (rendered by LegalSheet).

export type LegalBlock =
  | { t: 'h3' | 'h4' | 'p'; text: string }
  | { t: 'ul'; items: string[] }
  | { t: 'table'; head: string[]; rows: string[][] };

export type LegalSectionKey = 'privacy' | 'terms' | 'credits';

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
        "text": "Co-Heart is a mobile app for guardians (parents, family members, and caregivers) supporting learners with intellectual and developmental disabilities (IDD). This policy explains what information we collect, how we use it, who we share it with, and the choices you have."
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
  }
};
