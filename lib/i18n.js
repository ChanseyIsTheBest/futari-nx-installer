// Interface texts in English and Japanese. Works in the page and in the worker (no DOM here).
// Static texts in index.html name their key with data-i18n (plain text) or data-i18n-html (text with markup).

export const LANGUAGES = [
  { code: 'en', name: 'English', flag: 'uk' },
  { code: 'ja', name: '日本語', flag: 'japan' },
];

const SPHAIRA = '<a href="https://github.com/NaGaa95/sphaira/releases" target="_blank" rel="noopener">Sphaira</a>';
const DLC_PATH = '<code>Content/&lt;profile&gt;/435A07D7/00000002</code>';

const TEXTS = {
  en: {
    legal:
      'Mushihimesama Futari is a trademark of CAVE Interactive. The icon artwork is © CAVE. futari-nx is an unofficial fan project and is not affiliated with, endorsed or sponsored by CAVE, Nintendo or Microsoft. Nintendo Switch is a trademark of Nintendo; Xbox 360 is a trademark of Microsoft. This site does not host or distribute game data or the original game executable: your disc image is read only inside your browser, is never uploaded, and its files are copied straight into the futari-nx.zip saved on your computer. You need your own legally obtained copy of the game.',
    sourceCode: 'Source code',
    signature: 'a ChanseyIsTheBest project',
    lead:
      'Builds the <strong>Nintendo Switch</strong> package of <strong>Mushihimesama Futari Ver 1.5</strong> from your own ' +
      '<strong>Xbox 360</strong> disc. Everything runs in <strong>this browser</strong>.',
    languageBar: 'Language',
    step1: '1. Choose your game',
    formatPackage: 'Disc image',
    formatFolder: 'Folder',
    ownCopy:
      '<strong>Important:</strong> you need your own copy of the game, dumped from your own disc. The installer reads the game from it to make the package; without it, it cannot be made. Every game file in the package comes from your copy: the installer does not supply any of its own.',
    formatHint:
      "<strong>Disc image:</strong> your game's <code>.iso</code> (a full disc dump, or an image rebuilt by extract-xiso). You can choose the <strong>Black Label</strong> and <strong>Ver 1.01</strong> DLC package files along with it (on the console they are in " + DLC_PATH + '). ' +
      '<strong>Folder:</strong> a folder you extracted the game into (with <code>default.xex</code>); DLC package files or unpacked DLC folders inside it are found too.',
    nothingChosen: 'Nothing chosen yet.',
    chosenGame: 'Game: {name} ({size})',
    chosenDlc: 'DLC: {name} ({size})',
    chosenNoDlc: 'No DLC (optional: Black Label, Ver 1.01)',
    step2: '2. Create the package',
    step2First: 'If you are installing the game for the first time, use:',
    create: 'Create futari-nx.zip',
    step2Update:
      'If the game is already installed and you only want to update it (<code>futari.nro</code> and the shaders, plus the DLC if you chose it), use:',
    createUpdate: 'Create futari-nx-update.zip',
    step3: '3. Copy it to the Switch',
    step3Extract: 'Extract the downloaded zip into <code>sdmc:/switch/</code>.',
    step3Start:
      'Start <code>futari.nro</code> from the Homebrew Menu in title takeover mode (<strong>launch</strong> a game installed on the Switch ' +
      `<strong>while holding R</strong>) or create a <strong>39-bit forwarder</strong> with ${SPHAIRA}. The album applet does not give the game enough memory.`,
    step3First:
      'The first time you play, new places can <strong>stutter</strong> for a moment while the graphics are prepared; they are kept on the SD card for the next sessions. The DLC is installed by the game at its first start.',
    checking: 'Checking your game…',
    supported: 'Xbox 360 disc · supported',
    supportedWithDlc: 'Xbox 360 disc + DLC · supported',
    unsupported: 'This version of the game is not supported yet.',
    notGame: 'Not the game',
    noGame: 'The game was not found: choose its disc image, or a folder with default.xex.',
    otherTitle: '{name} is not Mushihimesama Futari.',
    noStreaming: 'this browser window cannot stream downloads. Use a normal (not private) window.',
    downloadStarted: 'Download started ({size}). Keep this page open until it finishes.',
    finished: 'Finished in {seconds} s.',
    error: 'Error: {message}',
    cancelled: 'the download was cancelled',
    readingFiles: 'Reading your game',
    downloadingBuild: 'Downloading the Switch build',
    logBuild: 'Supported: Mushihimesama Futari Ver 1.5 for Xbox 360 (build {version})',
    logUpdate: 'Update package: futari.nro and the shaders (and the DLC, if you chose it)',
    logDlc: 'DLC: {name}',
    foundShaders: "Found {count} shaders in the game's executables; building the shader library",
    translatedShaders: 'Translated {count} shaders',
    compiled: 'Compiled {done} of {total}',
    libraryReady: 'Shader library ready: it matches the tested one',
    gameIdentical: 'The game files are identical in number and size to the tested copy',
    gameDifferent: 'Warning: the game files differ from the tested copy (modified or damaged files?). The package is made anyway.',
    packing: 'Writing the package',
    done: 'Done: extract the zip into sdmc:/switch/',
    notSupportedYet: 'this version of the game is not supported yet. Executable fingerprint: {hash}',
    buildMismatch: 'the downloaded Switch build is not the published one ({hash}); try again later',
    libraryMismatch: 'the shader library does not match the tested one ({hash}); nothing was written',
    containersMismatch: 'the shaders of your game are not the tested ones; nothing was written',
    shaderMissing: "the game's {name} was not found in its executables",
    incompleteGame: 'Incomplete game: {count} of {expected} files. Only the update package can be made.',
    incompleteError: 'the game is incomplete ({count} of {expected} files): choose the whole game',
    downloadFailed: 'could not download {url} ({status})',
  },
  ja: {
    legal:
      '虫姫さまふたりは CAVE Interactive の商標です。アイコンのアートワークは © CAVE です。futari-nx は非公式のファンプロジェクトであり、CAVE、任天堂、Microsoft とは関係がなく、承認や支援も受けていません。Nintendo Switch は任天堂の商標です。Xbox 360 は Microsoft の商標です。このサイトはゲームデータや元の実行ファイルをホストも配布もしません。あなたのディスクイメージはブラウザ内でのみ読み込まれ、アップロードされることはなく、そのファイルはお使いのコンピューターに保存される futari-nx.zip に直接コピーされます。合法的に入手したご自身のゲームが必要です。',
    sourceCode: 'ソースコード',
    signature: 'ChanseyIsTheBest のプロジェクト',
    lead:
      'ご自身の <strong>Xbox 360</strong> 版ディスクから、<strong>虫姫さまふたり Ver 1.5</strong> の <strong>Nintendo Switch</strong> 用パッケージを作成します。すべての処理は<strong>このブラウザ内</strong>で行われます。',
    languageBar: '言語',
    step1: '1. ゲームを選ぶ',
    formatPackage: 'ディスクイメージ',
    formatFolder: 'フォルダー',
    ownCopy:
      '<strong>重要：</strong>ご自身のディスクから吸い出した、ご自身のゲームが必要です。インストーラーはそこからゲームを読み込んでパッケージを作成します。これがないと作成できません。パッケージ内のゲームファイルはすべてあなたのコピーから取得され、インストーラーはゲームファイルを一切提供しません。',
    formatHint:
      '<strong>ディスクイメージ：</strong>ゲームの <code>.iso</code>（ディスク全体の吸い出し、または extract-xiso で作り直したイメージ）。<strong>ブラックレーベル</strong>と <strong>Ver1.01</strong> の DLC パッケージファイルも一緒に選べます（本体では ' + DLC_PATH + ' にあります）。' +
      '<strong>フォルダー：</strong>ゲームを展開したフォルダー（<code>default.xex</code> を含むもの）。中にある DLC パッケージファイルや展開済みの DLC フォルダーも見つかります。',
    nothingChosen: 'まだ何も選ばれていません。',
    chosenGame: 'ゲーム：{name}（{size}）',
    chosenDlc: 'DLC：{name}（{size}）',
    chosenNoDlc: 'DLC なし（任意：ブラックレーベル、Ver1.01）',
    step2: '2. パッケージを作成する',
    step2First: '初めてゲームをインストールする場合：',
    create: 'futari-nx.zip を作成',
    step2Update: 'インストール済みで、更新（<code>futari.nro</code> とシェーダー、選んだ場合は DLC も）だけを行う場合：',
    createUpdate: 'futari-nx-update.zip を作成',
    step3: '3. Switch にコピーする',
    step3Extract: 'ダウンロードした zip を <code>sdmc:/switch/</code> に展開します。',
    step3Start:
      '<strong>タイトル乗っ取りモード</strong>の Homebrew Menu から <code>futari.nro</code> を起動するか（Switch にインストールされたゲームを <strong>R を押しながら起動</strong>）、' +
      `${SPHAIRA} で <strong>39 ビットのフォワーダー</strong>を作成します。アルバムアプレットではゲームに必要なメモリが足りません。`,
    step3First:
      '初めてプレイするときは、グラフィックの準備のため、新しい場所で一瞬<strong>カクつく</strong>ことがあります。準備したデータは SD カードに保存され、次回からは使い回されます。DLC は初回起動時にゲームがインストールします。',
    checking: 'ゲームを確認しています…',
    supported: 'Xbox 360 ディスク版 · 対応',
    supportedWithDlc: 'Xbox 360 ディスク版 + DLC · 対応',
    unsupported: 'このバージョンのゲームにはまだ対応していません。',
    notGame: 'ゲームではありません',
    noGame: 'ゲームが見つかりません。ディスクイメージ、または default.xex を含むフォルダーを選んでください。',
    otherTitle: '{name} は虫姫さまふたりではありません。',
    noStreaming: 'このブラウザウィンドウではダウンロードをストリーミングできません。通常の（プライベートではない）ウィンドウを使ってください。',
    downloadStarted: 'ダウンロードを開始しました（{size}）。完了するまでこのページを開いたままにしてください。',
    finished: '{seconds} 秒で完了しました。',
    error: 'エラー：{message}',
    cancelled: 'ダウンロードがキャンセルされました',
    readingFiles: 'ゲームを読み込んでいます',
    downloadingBuild: 'Switch 版をダウンロードしています',
    logBuild: '対応：Xbox 360 版 虫姫さまふたり Ver 1.5（ビルド {version}）',
    logUpdate: '更新パッケージ：futari.nro とシェーダー（選んだ場合は DLC も）',
    logDlc: 'DLC：{name}',
    foundShaders: 'ゲームの実行ファイルから {count} 個のシェーダーが見つかりました。シェーダーライブラリを作成しています',
    translatedShaders: '{count} 個のシェーダーを変換しました',
    compiled: '{total} 個中 {done} 個をコンパイルしました',
    libraryReady: 'シェーダーライブラリの準備ができました（テスト済みのものと一致）',
    gameIdentical: 'ゲームファイルの数とサイズはテスト済みのコピーと同一です',
    gameDifferent: '警告：ゲームファイルがテスト済みのコピーと異なります（改変または破損したファイル？）。パッケージはそのまま作成されます。',
    packing: 'パッケージを書き込んでいます',
    done: '完了：zip を sdmc:/switch/ に展開してください',
    notSupportedYet: 'このバージョンのゲームにはまだ対応していません。実行ファイルのフィンガープリント：{hash}',
    buildMismatch: 'ダウンロードした Switch 版が公開版と一致しません（{hash}）。しばらくしてからもう一度お試しください',
    libraryMismatch: 'シェーダーライブラリがテスト済みのものと一致しません（{hash}）。何も書き込まれていません',
    containersMismatch: 'ゲームのシェーダーがテスト済みのものと異なります。何も書き込まれていません',
    shaderMissing: 'ゲームの実行ファイルに {name} が見つかりません',
    incompleteGame: 'ゲームが不完全です：{expected} ファイル中 {count} ファイル。更新パッケージのみ作成できます。',
    incompleteError: 'ゲームが不完全です（{expected} ファイル中 {count} ファイル）。ゲーム全体を選んでください',
    downloadFailed: '{url} をダウンロードできませんでした（{status}）',
  },
};

let current = 'en';

export function getLanguage() {
  return current;
}

export function setLanguage(code) {
  current = TEXTS[code] ? code : 'en';
  return current;
}

// The visitor's choice (saved in their browser), else the browser's language when it is one of ours, else English.
export function preferredLanguage(saved, browser = []) {
  if (saved && TEXTS[saved]) {
    return saved;
  }
  for (const tag of browser) {
    const code = String(tag).toLowerCase().split('-')[0];
    if (TEXTS[code]) {
      return code;
    }
  }
  return 'en';
}

export function t(key, params = {}) {
  const text = TEXTS[current][key] ?? TEXTS.en[key] ?? key;
  return text.replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? `{${name}}`));
}

// Sizes as Windows Explorer shows them, so the page and the file's properties agree: units of 1024 bytes (which
// Windows calls KB, MB and GB) and three significant digits, truncated. 7,834,892,288 bytes is 7.29 GB, not 7.83.
const SIZE_UNITS = {};

export function formatSize(bytes) {
  const units = SIZE_UNITS[current] ?? ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1000 && unit < units.length - 1) {
    value /= 1024;
    unit++;
  }
  const decimals = value >= 100 ? 0 : value >= 10 ? 1 : 2;
  const scale = 10 ** decimals;
  // The small epsilon keeps values such as 7.3 from becoming 7.29 through floating point.
  const shown = Math.floor(value * scale + 1e-9) / scale;
  const number = new Intl.NumberFormat(current, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  return `${number.format(shown)} ${units[unit]}`;
}
