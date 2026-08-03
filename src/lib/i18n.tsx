import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type UiLang = "sw" | "en";

const STORAGE_KEY = "kikabila.ui-lang";

const dict = {
  sw: {
    "nav.play": "Cheza",
    "nav.consensus": "Maafikiano",
    "nav.review": "Ukaguzi",
    "nav.corpus": "Kamusi",
    "nav.leaders": "Viongozi",
    "nav.signIn": "Ingia",
    "nav.signOut": "Toka",

    "common.loading": "Inapakia…",
    "common.language": "Lugha",
    "lang.mine": "Zangu",
    "lang.myLanguages": "Lugha zangu",
    "lang.allLanguages": "Lugha zote",

    "play.player": "Mchezaji",
    "play.level": "Ngazi",
    "play.xpToLevel": "XP kufikia ngazi",
    "play.streak": "mfululizo",
    "play.trust": "uaminifu",
    "play.dailyGoal": "Lengo la leo",
    "play.words": "maneno",
    "play.streakSafe": " · mfululizo salama",
    "play.emptyTitle": "Hakuna kilichobaki hapa",
    "play.emptyBody": "Umejibu kila neno lililo wazi kwa lugha hii. Jaribu lugha nyingine.",
    "play.howDoYouSay": "Unasemaje",
    "play.answerPlaceholder": "Tafsiri yako",
    "play.notePlaceholder": "Maelezo ya kitamaduni (hiari, +5 XP) — neno hili hutumika lini?",
    "play.lockIn": "Tuma",
    "play.next": "Neno linalofuata",
    "play.locked": "Jibu limethibitishwa",
    "play.lockedSub": "Asante kwa kuchangia",
    "play.yourAnswer": "Jibu lako",
    "play.consensusTitle": "Maafikiano ya jamii",
    "play.youMatch": "Unalingana na kinara",
    "play.youDiffer": "Jibu lako ni tofauti",
    "play.obs": "ushahidi",
    "play.confidence": "uhakika",
    "play.confLow": "Uhakika mdogo",
    "play.confMed": "Uhakika wa wastani",
    "play.confHigh": "Uhakika mkubwa",
    "play.firstHere": "Wewe ni miongoni mwa wa kwanza — uhakika hukua wasemaji wengine wanapothibitisha.",

    "landing.kicker": "Kamusi ya lugha za Tanzania",
    "landing.title": "Kila jibu unalotoa hufundisha lugha kwa vizazi vijavyo.",
    "landing.body":
      "Kikabila hugeuza isimu ya uwandani kuwa mchezo. Jibu neno la Kiswahili kwa lugha yako ya mama, thibitisha jibu, na tazama maafikiano ya jamii yakiundwa. Wakaguzi hupandisha majibu bora kwenye kamusi ya kudumu.",
    "landing.start": "Anza kucheza",
    "landing.browse": "Vinjari kamusi",
    "landing.f1t": "Injini ya Changamoto",
    "landing.f1d": "Maswali huelekezwa kwa maneno yasiyo na data, yenye mgongano au uhakika mdogo.",
    "landing.f2t": "Injini ya Maafikiano",
    "landing.f2d": "Makubaliano yenye uzito wa uaminifu hugeuza majibu kuwa wagombea waliopimwa.",
    "landing.f3t": "Kamusi isiyobadilika",
    "landing.f3d": "Wakaguzi hupandisha wagombea; maingizo yaliyothibitishwa huhifadhiwa kwa matoleo.",

    "auth.joinTitle": "Jiunge na ukusanyaji",
    "auth.welcome": "Karibu tena",
    "auth.sub": "Majibu yako huwa maafikiano ya jamii, kisha kumbukumbu ya kudumu.",
    "auth.google": "Endelea na Google",
    "auth.or": "au",
    "auth.displayName": "Jina la kuonyesha",
    "auth.email": "Barua pepe",
    "auth.password": "Nenosiri",
    "auth.create": "Fungua akaunti",
    "auth.signIn": "Ingia",
    "auth.haveAccount": "Tayari una akaunti? Ingia",
    "auth.newHere": "Ni mgeni? Fungua akaunti",
    "auth.created": "Akaunti imeundwa",
    "auth.googleFailed": "Kuingia kwa Google kumeshindikana",
    "auth.generic": "Hitilafu imetokea",
    "auth.checkInbox": "Angalia kikasha chako",
    "auth.confirmSent": "Tumekutumia barua pepe ya uthibitisho kwa",
    "auth.confirmBody": "Bonyeza kiungo kwenye barua pepe hiyo ili kukamilisha usajili wako, kisha urudi uingie.",
    "auth.alreadyConfirmed": "Nimethibitisha tayari — ingia",
    "auth.notConfirmed": "Thibisha barua pepe yako kwanza. Angalia kikasha chako.",
    "auth.alreadyExists": "Anwani hii ya barua pepe tayari imesajiliwa.",
    "auth.forgot": "Umesahau nenosiri?",
    "auth.resetTitle": "Weka upya nenosiri",
    "auth.resetBody": "Tutakutumia kiungo cha kubadilisha nenosiri lako.",
    "auth.resetSend": "Tuma kiungo",
    "auth.resetSent": "Angalia kikasha chako — tumetuma kiungo cha kubadilisha nenosiri.",
    "auth.backToSignIn": "Rudi kuingia",
    "auth.langTitle": "Unazungumza lugha zipi?",
    "auth.langBody": "Tutapanga changamoto zako kutoka lugha hizi kwanza. Unaweza kubadilisha wakati wowote.",
    "auth.langSave": "Anza kucheza →",
    "auth.langSkip": "Ruka — nionyeshe lugha zote",
    "auth.langSelected": "lugha zilizochaguliwa",
    "error.notFound": "Ukurasa haukupatikana",
    "error.notFoundBody": "Ukurasa unaotafuta hauko au umehamishwa.",
    "error.goHome": "Rudi nyumbani",
    "error.title": "Ukurasa haukupakia",
    "error.body": "Kuna hitilafu. Jaribu tena au rudi nyumbani.",
    "error.retry": "Jaribu tena",

    "consensus.title": "Injini ya maafikiano",
    "consensus.body":
      "Kila jibu hupangwa kwa umbo sanifu na kupewa uzito kwa alama ya uaminifu ya mchangiaji. Uhakika huchanganya makubaliano na idadi ya ushahidi huru.",
    "consensus.empty": "Hakuna wagombea kwa lugha hii bado — cheza changamoto chache kuzalisha ushahidi.",
    "consensus.for": "kwa",
    "consensus.agree": "wanakubali",
    "consensus.signInTitle": "Ingia ili kuona maafikiano",
    "consensus.signInBody": "Wagombea wanaohitaji ukaguzi wanaonekana kwa wachangiaji walioingia.",

    "review.title": "Foleni ya ukaguzi",
    "review.body":
      "Kupandisha ni kwa kudumu: huandika toleo jipya lisilobadilika kwenye kamusi na kuhifadhi la awali. Pima ushahidi kabla ya kuamua.",
    "review.signIn": "Ingia ili kufikia foleni ya ukaguzi.",
    "review.needAccess": "Uthibitisho wa mkaguzi unahitajika",
    "review.needAccessBody": "Wakaguzi na wasimamizi pekee wanaweza kupandisha wagombea kwenye kamusi.",
    "review.claim": "Dai umiliki (mtumiaji wa kwanza pekee)",
    "review.claimed": "Sasa wewe ni msimamizi na mkaguzi",
    "review.adminExists": "Msimamizi tayari yupo",
    "review.emptyQueue": "Hakuna kinachosubiri ukaguzi katika lugha hii.",
    "review.competing": "Wagombea wanaoshindana",
    "review.evidence": "Ushahidi wa majibu",
    "review.history": "Historia ya kamusi",
    "review.noHistory": "Hakuna ingizo lililothibitishwa kwa neno hili — kupandisha huunda toleo la 1.",
    "review.notePlaceholder": "Maelezo ya mkaguzi (yataandikwa kwenye kumbukumbu)",
    "review.promote": "Pandisha kwenye kamusi",
    "review.reject": "Kataa",
    "review.promoted": "Imepandishwa kwenye kamusi",
    "review.rejected": "Mgombea amekataliwa",
    "review.weight": "uzito",

    "corpus.title": "Kamusi iliyothibitishwa",
    "corpus.body":
      "Maingizo yaliyothibitishwa hayabadiliki. Marekebisho hayafuti: kupandisha mgombea mpya huunda toleo linalofuata na kuhifadhi la zamani, likiwa na kumbukumbu kamili.",
    "corpus.verifiedOf": "yamethibitishwa / lengo",
    "corpus.coverage": "Ufikiaji wa katalogi:",
    "corpus.ofBaseWords": "kati ya maneno msingi",
    "corpus.empty": "Hakuna kilichothibitishwa kwa lugha hii bado. Wagombea lazima wapite foleni ya ukaguzi kwanza.",
    "corpus.signInTitle": "Ingia ili kuona kamusi",
    "corpus.signInBody": "Maingizo yaliyothibitishwa yanapatikana kwa wachangiaji walioingia.",

    "board.title": "Ubao wa viongozi",
    "board.body":
      "XP huongoza maendeleo. Uaminifu ni tofauti — hupatikana kwa kukubaliana na maafikiano na hupima uzito wa majibu yako.",
    "board.empty": "Hakuna wachangiaji bado — kuwa wa kwanza kucheza.",
    "board.anon": "Mchangiaji asiyejulikana",
    "board.trust": "uaminifu",
    "board.allTime": "Wakati wote",
    "board.thisWeek": "Wiki hii",
    "board.weekXp": "XP ya wiki hii",
    "board.you": "Wewe",
    "board.weekEmpty": "Hakuna aliyefunga wiki hii bado — fungua wiki kwa jibu la kwanza.",
    "board.badges": "beji",
    "board.signInTitle": "Ingia ili kuona viongozi",
    "board.signInBody": "Jiunge na washindani wanaotoa mchango kwa lugha za Tanzania.",

    "nav.profile": "Wasifu",

    "hud.gems": "vito",
    "hud.rank": "nafasi",
    "hud.freeze": "kinga ya mfululizo inapatikana",
    "hud.useFreeze": "Tumia kinga",
    "hud.freezeUsed": "Mfululizo umeokolewa kwa kinga",
    "hud.freezeFailed": "Hakuna haja ya kinga sasa",

    "quest.title": "Misheni za leo",
    "quest.body": "Malengo madogo, zawadi halisi. Huanza upya usiku wa manane.",
    "quest.words": "Jibu maneno yako ya leo",
    "quest.spark": "Cheza neno lako la kwanza leo",
    "quest.notes": "Ongeza maelezo 2 ya kitamaduni",
    "quest.langs": "Changia katika lugha 2",
    "quest.done": "Imekamilika",
    "quest.allDone": "Misheni yote imekamilika",

    "celebrate.levelUp": "Umepanda ngazi!",
    "celebrate.levelUpSub": "Sasa wewe ni",
    "celebrate.badge": "Beji imefunguliwa",
    "celebrate.goal": "Lengo la leo limekamilika!",
    "celebrate.goalSub": "Mfululizo umelindwa · +50 XP",
    "celebrate.match": "Umelingana na maafikiano!",

    "profile.title": "Rafu yako ya tuzo",
    "profile.body": "Kila kitu ulichokusanya kwa ajili ya kamusi hadi sasa.",
    "profile.badges": "Beji",
    "profile.locked": "Imefungwa",
    "profile.stats": "Takwimu za maisha",
    "profile.settings": "Mipangilio",
    "profile.dailyGoal": "Lengo la kila siku",
    "profile.myLanguages": "Lugha zangu",
    "profile.saveLangs": "Hifadhi lugha",
    "profile.saved": "Imehifadhiwa",
    "profile.words": "Maneno uliyochangia",
    "profile.notesStat": "Maelezo ya kitamaduni",
    "profile.langsStat": "Lugha ulizogusa",
    "profile.agreed": "Kulingana na maafikiano",
    "profile.verifiedStat": "Yamethibitishwa kamusini",
    "profile.weekXp": "XP ya wiki hii",
    "profile.longest": "Mfululizo mrefu zaidi",
    "profile.recent": "XP za hivi karibuni",
    "profile.signIn": "Ingia ili kuona rafu yako ya tuzo.",
  },
  en: {
    "nav.play": "Play",
    "nav.consensus": "Consensus",
    "nav.review": "Review",
    "nav.corpus": "Corpus",
    "nav.leaders": "Leaders",
    "nav.signIn": "Sign in",
    "nav.signOut": "Sign out",

    "common.loading": "Loading…",
    "common.language": "Language",
    "lang.mine": "Mine",
    "lang.myLanguages": "My languages",
    "lang.allLanguages": "All languages",

    "play.player": "Player",
    "play.level": "Level",
    "play.xpToLevel": "XP to level",
    "play.streak": "streak",
    "play.trust": "trust",
    "play.dailyGoal": "Daily goal",
    "play.words": "words",
    "play.streakSafe": " · streak safe",
    "play.emptyTitle": "Nothing left to collect here",
    "play.emptyBody": "You've answered every open word for this language. Try another one.",
    "play.howDoYouSay": "How do you say",
    "play.answerPlaceholder": "Your translation",
    "play.notePlaceholder": "Cultural note (optional, +5 XP) — when is this word used?",
    "play.lockIn": "Submit",
    "play.next": "Next word",
    "play.locked": "Answer locked in",
    "play.lockedSub": "Thanks for contributing",
    "play.yourAnswer": "Your answer",
    "play.consensusTitle": "Community consensus",
    "play.youMatch": "You match the leader",
    "play.youDiffer": "Your answer differs",
    "play.obs": "obs",
    "play.confidence": "confidence",
    "play.confLow": "Very low confidence",
    "play.confMed": "Building consensus",
    "play.confHigh": "Strong consensus",
    "play.firstHere": "You're one of the first here — confidence grows as more speakers corroborate.",

    "landing.kicker": "Tanzanian language corpus",
    "landing.title": "Every answer you give teaches a language to the future.",
    "landing.body":
      "Kikabila turns field linguistics into a game. Answer a Swahili word in your mother tongue, lock your answer, and watch the community's consensus form. Reviewers promote the strongest candidates into a permanent, verified corpus.",
    "landing.start": "Start playing",
    "landing.browse": "Browse the corpus",
    "landing.f1t": "Challenge Engine",
    "landing.f1d": "Adaptive prompts target words with no data, conflicts or weak confidence.",
    "landing.f2t": "Consensus Engine",
    "landing.f2d": "Trust-weighted agreement turns raw submissions into scored candidates.",
    "landing.f3t": "Immutable corpus",
    "landing.f3d": "Reviewers promote candidates; verified entries are versioned, never edited.",

    "auth.joinTitle": "Join the collection",
    "auth.welcome": "Welcome back",
    "auth.sub": "Your answers become community consensus, then a permanent record.",
    "auth.google": "Continue with Google",
    "auth.or": "or",
    "auth.displayName": "Display name",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.create": "Create account",
    "auth.signIn": "Sign in",
    "auth.haveAccount": "Already have an account? Sign in",
    "auth.newHere": "New here? Create an account",
    "auth.created": "Account created",
    "auth.googleFailed": "Google sign-in failed",
    "auth.generic": "Something went wrong",
    "auth.checkInbox": "Check your inbox",
    "auth.confirmSent": "We've sent a confirmation email to",
    "auth.confirmBody": "Click the link in that email to finish signing up, then come back here to sign in.",
    "auth.alreadyConfirmed": "Already confirmed — sign me in",
    "auth.notConfirmed": "Please confirm your email first. Check your inbox.",
    "auth.alreadyExists": "This email address is already registered.",
    "auth.forgot": "Forgot password?",
    "auth.resetTitle": "Reset your password",
    "auth.resetBody": "We'll send you a link to set a new password.",
    "auth.resetSend": "Send reset link",
    "auth.resetSent": "Check your inbox — we've sent a password reset link.",
    "auth.backToSignIn": "Back to sign in",
    "auth.langTitle": "Which languages do you speak?",
    "auth.langBody": "We'll prioritise challenges from these languages. You can change this anytime.",
    "auth.langSave": "Start playing →",
    "auth.langSkip": "Skip — show me all languages",
    "auth.langSelected": "languages selected",
    "error.notFound": "Page not found",
    "error.notFoundBody": "The page you're looking for doesn't exist or has been moved.",
    "error.goHome": "Go home",
    "error.title": "This page didn't load",
    "error.body": "Something went wrong. Try again or head back home.",
    "error.retry": "Try again",

    "consensus.title": "Consensus engine",
    "consensus.body":
      "Every submission is grouped by normalized form and weighted by the contributor's trust score. Confidence combines agreement with how many independent observations exist.",
    "consensus.empty": "No candidates for this language yet — play a few challenges to generate observations.",
    "consensus.for": "for",
    "consensus.agree": "agree",
    "consensus.signInTitle": "Sign in to view consensus",
    "consensus.signInBody": "Candidates awaiting review are visible to signed-in contributors.",

    "review.title": "Reviewer queue",
    "review.body":
      "Promotion is permanent: it writes a new immutable version into the corpus and archives the previous one. Weigh the evidence before you decide.",
    "review.signIn": "Sign in to access the reviewer queue.",
    "review.needAccess": "Reviewer access required",
    "review.needAccessBody": "Only reviewers and admins can promote candidates into the verified corpus.",
    "review.claim": "Claim owner access (first user only)",
    "review.claimed": "You are now the project admin & reviewer",
    "review.adminExists": "An admin already exists",
    "review.emptyQueue": "Nothing waiting for review in this language.",
    "review.competing": "Competing candidates",
    "review.evidence": "Submission evidence",
    "review.history": "Corpus history",
    "review.noHistory": "No verified entry for this word yet — promoting creates version 1.",
    "review.notePlaceholder": "Reviewer note (recorded in the audit trail)",
    "review.promote": "Promote to corpus",
    "review.reject": "Reject",
    "review.promoted": "Promoted into the corpus",
    "review.rejected": "Candidate rejected",
    "review.weight": "weight",

    "corpus.title": "Verified corpus",
    "corpus.body":
      "Verified entries are immutable. Corrections never overwrite: promoting a new candidate creates the next version and archives the previous one, with a full audit trail.",
    "corpus.verifiedOf": "verified / target",
    "corpus.coverage": "Catalog coverage:",
    "corpus.ofBaseWords": "of base words",
    "corpus.empty": "Nothing verified for this language yet. Candidates must clear the reviewer queue first.",
    "corpus.signInTitle": "Sign in to browse the corpus",
    "corpus.signInBody": "Verified entries are available to signed-in contributors.",

    "board.title": "Leaderboard",
    "board.body":
      "XP drives progression. Trust is separate — it's earned by agreeing with consensus and it weights how much your submissions count.",
    "board.empty": "No contributors yet — be the first to play.",
    "board.anon": "Anonymous contributor",
    "board.trust": "trust",
    "board.allTime": "All time",
    "board.thisWeek": "This week",
    "board.weekXp": "XP this week",
    "board.you": "You",
    "board.weekEmpty": "Nobody has scored this week yet — open the week with the first answer.",
    "board.badges": "badges",
    "board.signInTitle": "Sign in to see the leaderboard",
    "board.signInBody": "Join the contributors building the Tanzanian language corpus.",

    "nav.profile": "Profile",

    "hud.gems": "gems",
    "hud.rank": "rank",
    "hud.freeze": "streak freeze available",
    "hud.useFreeze": "Use freeze",
    "hud.freezeUsed": "Streak saved with a freeze",
    "hud.freezeFailed": "No freeze needed right now",

    "quest.title": "Today's quests",
    "quest.body": "Small goals, real bonuses. They reset at midnight.",
    "quest.words": "Answer your daily words",
    "quest.spark": "Play your first word of the day",
    "quest.notes": "Add 2 cultural notes",
    "quest.langs": "Contribute in 2 languages",
    "quest.done": "Done",
    "quest.allDone": "All quests complete",

    "celebrate.levelUp": "Level up!",
    "celebrate.levelUpSub": "You are now",
    "celebrate.badge": "Badge unlocked",
    "celebrate.goal": "Daily goal complete!",
    "celebrate.goalSub": "Streak protected · +50 XP",
    "celebrate.match": "Consensus match!",

    "profile.title": "Your trophy shelf",
    "profile.body": "Everything you have collected for the corpus so far.",
    "profile.badges": "Badges",
    "profile.locked": "Locked",
    "profile.stats": "Lifetime stats",
    "profile.settings": "Settings",
    "profile.dailyGoal": "Daily goal",
    "profile.myLanguages": "My languages",
    "profile.saveLangs": "Save languages",
    "profile.saved": "Saved",
    "profile.words": "Words contributed",
    "profile.notesStat": "Cultural notes",
    "profile.langsStat": "Languages touched",
    "profile.agreed": "Consensus matches",
    "profile.verifiedStat": "Verified into corpus",
    "profile.weekXp": "XP this week",
    "profile.longest": "Longest streak",
    "profile.recent": "Recent XP",
    "profile.signIn": "Sign in to see your trophy shelf.",
  },
} as const;

export type TKey = keyof (typeof dict)["sw"];

const Ctx = createContext<{ lang: UiLang; setLang: (l: UiLang) => void; t: (k: TKey) => string }>({
  lang: "sw",
  setLang: () => {},
  t: (k) => dict.sw[k],
});

export function UiLangProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<UiLang>("sw");

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored === "en" || stored === "sw") setLangState(stored);
  }, []);

  function setLang(l: UiLang) {
    setLangState(l);
    window.localStorage.setItem(STORAGE_KEY, l);
    document.documentElement.lang = l;
  }

  return (
    <Ctx.Provider value={{ lang, setLang, t: (k: TKey) => dict[lang][k] ?? dict.sw[k] }}>
      {children}
    </Ctx.Provider>
  );
}

export function useT() {
  return useContext(Ctx);
}

export function UiLangToggle() {
  const { lang, setLang } = useT();
  return (
    <button
      onClick={() => setLang(lang === "sw" ? "en" : "sw")}
      aria-label={lang === "sw" ? "Switch to English" : "Badilisha kwa Kiswahili"}
      className="rounded-full border border-border px-2.5 py-1 text-xs font-medium uppercase tracking-wide text-muted-foreground transition-colors hover:text-foreground"
    >
      {lang === "sw" ? "SW" : "EN"}
    </button>
  );
}
