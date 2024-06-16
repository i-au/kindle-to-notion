export interface Clipping {
  hash_id: string;
  title: string;
  author: string;
  highlight: string;
  page: string;
  location: string;
  date: string;
}

export interface GroupedClipping {
  title: string;
  author: string;
  highlights: string[];
}

export interface ClipSync {
  hash_id: string;
  date: string;
}

export interface Sync {
  title: string;
  author: string;
  highlightCount: number;
}
