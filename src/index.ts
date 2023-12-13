import path from 'path';
import fs from 'fs';
import type { Mod } from './types';
import { pipeline } from 'stream/promises';
import decompress from 'decompress';
import archiver from 'archiver';

// util function
const loadMods = async () => {
  // check if modlist.json exists in the parent directory
  const modlistPath = path.join(__dirname, '..', 'modlist.json');

  console.log(modlistPath);

  if (!fs.existsSync(modlistPath)) {
    console.log('modlist.json not found');
    return;
  }

  // load modlist.json
  const modlist = JSON.parse(fs.readFileSync(modlistPath, 'utf8'));

  // return mods array
  return modlist?.mods || [];
};
const downloadMod = async (mod: Mod) => {
  // check source
  if (mod.source === 'github') {
    // get repo by url (remove "https://github.com/"")
    const repo = mod.url.replace('https://github.com/', '');

    // get latest release
    const response = await fetch(`https://api.github.com/repos/${repo}/releases/latest`);

    // parse release
    const release = await response.json();

    // get download url by name beginn with assetNameStartsWith
    const downloadUrl = release.assets.find((asset: any) =>
      asset.name.startsWith(mod.assetNameStartsWith)
    ).browser_download_url;

    // get tmp path
    const tmpPath = path.join(__dirname, 'tmp', mod.name);

    // create tmp folder if not exists
    if (!fs.existsSync(tmpPath)) {
      fs.mkdirSync(tmpPath);
    }

    // download mod
    const download = await fetch(downloadUrl);

    if (!download.ok) {
      throw new Error(`Failed to download mod from ${downloadUrl}: ${download.statusText}`);
    }

    // create write stream
    const fileStream = fs.createWriteStream(path.join(tmpPath, `${mod.name}.${mod.assetType}`));

    // pipe download to file
    await pipeline(download.body, fileStream);
  } else if (mod.source === 'thunderstoreIo') {
    // get html from url
    const response = await fetch(mod.url);

    // parse html
    const html = await response.text();

    // get all a tags with type="button"
    const buttons = html.match(/<a.*?type="button".*?>/g);

    // check if buttons exists
    if (!buttons) {
      throw new Error('Failed to get download url');
    }

    // get download url by first button contains "https://thunderstore.io/package/download/*" as href
    const downloadUrl = buttons
      .find((button) => {
        const href = button.match(/href="(.*?)"/);

        if (!href) {
          return false;
        }

        return href[1].startsWith('https://thunderstore.io/package/download/');
      })
      ?.match(/href="(.*?)"/)?.[1];

    // check if download url exists
    if (!downloadUrl) {
      throw new Error('Failed to get download url');
    }

    // get tmp path
    const tmpPath = path.join(__dirname, 'tmp', mod.name);

    // create tmp folder if not exists
    if (!fs.existsSync(tmpPath)) {
      fs.mkdirSync(tmpPath);
    }

    // download mod
    const download = await fetch(downloadUrl);

    if (!download.ok) {
      throw new Error(`Failed to download mod from ${downloadUrl}: ${download.statusText}`);
    }

    // create write stream
    const fileStream = fs.createWriteStream(path.join(tmpPath, `${mod.name}.${mod.assetType}`));

    // pipe download to file
    await pipeline(download.body, fileStream);
  }
};
const extractMod = async (mod: Mod) => {
  // get tmp path
  const tmpPath = path.join(__dirname, 'tmp', mod.name);

  // get output path
  const outputPath = path.join(__dirname, '..', 'output');

  // create output folder if not exists
  if (!fs.existsSync(outputPath)) {
    fs.mkdirSync(outputPath);
  }

  // extract mod
  await decompress(path.join(tmpPath, `${mod.name}.zip`), outputPath);
};
const moveDll = async (mod: Mod) => {
  // get tmp path
  const tmpPath = path.join(__dirname, 'tmp', mod.name);

  // get output path
  const outputPath = path.join(__dirname, '..', 'output', 'BepInEx', 'plugins');

  // move dll
  fs.renameSync(path.join(tmpPath, `${mod.name}.dll`), path.join(outputPath, `${mod.name}.dll`));
};
const zipOutput = async () => {
  // get output path
  const outputPath = path.join(__dirname, '..', 'output');

  // get zip path
  const zipPath = path.join(__dirname, '..', 'output.zip');

  // create zip file
  const output = fs.createWriteStream(zipPath);

  // create archive
  const archive = archiver('zip', { zlib: { level: 9 } });

  // pipe archive to output
  archive.pipe(output);

  // add output to archive
  archive.glob(`**/*`, { cwd: outputPath });

  // finalize archive
  archive.finalize();
};

// main function
const main = async () => {
  // load mods
  const mods = await loadMods();

  // download mods
  for (const mod of mods) {
    console.log(`Trying to download ${mod.name}...`);
    try {
      await downloadMod(mod);
      console.log(`Downloaded ${mod.name} successfully!`);
    } catch (error) {
      console.error(error);
    }
  }

  // extract mods (only zip files)
  for (const mod of mods.filter((mod) => mod.assetType === 'zip')) {
    console.log(`Trying to extract ${mod.name}...`);
    try {
      await extractMod(mod);
      console.log(`Extracted ${mod.name} successfully!`);
    } catch (error) {
      console.error(error);
    }
  }

  // move dlls (only dll files)
  for (const mod of mods.filter((mod) => mod.assetType === 'dll')) {
    console.log(`Trying to move ${mod.name}...`);
    try {
      await moveDll(mod);
      console.log(`Moved ${mod.name} successfully!`);
    } catch (error) {
      console.error(error);
    }
  }

  // zip output
  console.log(`Trying to zip output...`);
  try {
    await zipOutput();
    console.log(`Zipped output successfully!`);
  } catch (error) {
    console.error(error);
  }
};

// run main function
main();
