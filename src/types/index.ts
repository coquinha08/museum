export interface UserProfile {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
}

export interface Manuscript {
  id: string;
  ownerId: string;
  ownerEmail?: string;
  ownerName?: string;
  title: string;
  genre: string;
  synopsis: string;
  tone: string;
  characters: string;
  worldRules: string;
  visibility: 'private' | 'shared';
  createdAt: string;
  updatedAt: string;
}

export interface Scene {
  id: string;
  manuscriptId: string;
  ownerId: string;
  order: number;
  chapterTitle: string;
  sceneTitle: string;
  promptOutline: string;
  content: string;
  wordCount: number;
  updatedAt: string;
}
