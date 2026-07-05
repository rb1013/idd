import { File, Directory, Paths } from 'expo-file-system';

const symbolsDir = new Directory(Paths.document, 'aac_symbols');
const metadataFile = new File(symbolsDir, 'symbols.json');

export interface AACSymbol {
  keyword: string;
  name: string;
  imageUrl: string;  // remote URL — sent as message content so recipient can render it
  localUri: string;  // local file URI — used for board rendering, works offline
}

const SYMBOL_DEFINITIONS = [
  { keyword: 'hello',     name: 'Hello'     },
  { keyword: 'goodbye',   name: 'Goodbye'   },
  { keyword: 'happy',     name: 'Happy'     },
  { keyword: 'sad',       name: 'Sad'       },
  { keyword: 'tired',     name: 'Tired'     },
  { keyword: 'angry',     name: 'Angry'     },
  { keyword: 'yes',       name: 'Yes'       },
  { keyword: 'no',        name: 'No'        },
  { keyword: 'help',      name: 'Help'      },
  { keyword: 'thank you', name: 'Thank you' },
  { keyword: 'hug',       name: 'Hug'       },
  { keyword: 'love',      name: 'Love'      },
  { keyword: 'hungry',    name: 'Hungry'    },
  { keyword: 'play',      name: 'Play'      },
  { keyword: 'wait',      name: 'Wait'      },
];

async function fetchRemoteSymbol(keyword: string): Promise<{ imageUrl: string; name: string } | null> {
  try {
    const res = await fetch(
      `https://www.opensymbols.org/api/v1/symbols/search?q=${encodeURIComponent(keyword)}&limit=10`,
    );
    const data: any[] = await res.json();
    if (!data?.length) return null;
    // Prefer PNG/JPG — React Native Image doesn't render SVG natively
    const raster = data.find(s => s.image_url && !/\.svg(\?|$)/i.test(s.image_url));
    const symbol = raster ?? data[0];
    return { imageUrl: symbol.image_url, name: symbol.name ?? keyword };
  } catch {
    return null;
  }
}

export async function loadAACSymbols(): Promise<AACSymbol[]> {
  if (!symbolsDir.exists) {
    symbolsDir.create();
  }

  if (metadataFile.exists) {
    const raw = await metadataFile.text();
    return JSON.parse(raw) as AACSymbol[];
  }

  // First-time setup — fetch from API then download each image locally
  const results: (AACSymbol | null)[] = await Promise.all(
    SYMBOL_DEFINITIONS.map(async ({ keyword, name }) => {
      const remote = await fetchRemoteSymbol(keyword);
      if (!remote) return null;

      const ext = remote.imageUrl.split('.').pop()?.split('?')[0]?.toLowerCase() || 'png';
      const localFile = new File(symbolsDir, keyword.replace(/ /g, '_') + '.' + ext);

      try {
        await File.downloadFileAsync(remote.imageUrl, localFile);
        return { keyword, name, imageUrl: remote.imageUrl, localUri: localFile.uri };
      } catch {
        // Download failed — keep remote URL so board still works on first open
        return { keyword, name, imageUrl: remote.imageUrl, localUri: remote.imageUrl };
      }
    }),
  );

  const ordered = SYMBOL_DEFINITIONS
    .map(def => results.find(r => r?.keyword === def.keyword) ?? null)
    .filter(Boolean) as AACSymbol[];

  metadataFile.write(JSON.stringify(ordered));
  return ordered;
}

export function isSymbolMessage(content: string): boolean {
  return content.startsWith('http://') || content.startsWith('https://');
}
