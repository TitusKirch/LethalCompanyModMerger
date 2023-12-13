export type Mod = {
  name: string;
  source: 'github' | 'thunderstoreIo';
  url: string;
  assetType: 'zip' | 'dll';
  assetNameStartsWith?: string;
};
