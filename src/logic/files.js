/* GYMKDR · files in and out: a CSV or backup picked from the phone (Files, iCloud Drive, Google
   Drive, an email attachment), and an export handed to the share sheet (save to Files, AirDrop,
   email it to yourself). In a browser, an ordinary download. */
import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';
import { File, Paths } from 'expo-file-system';

const web = Platform.OS === 'web';

// The text of one file the lifter picks, or null if they cancel.
export async function pickText() {
  const res = await DocumentPicker.getDocumentAsync({ type: ['text/csv', 'text/comma-separated-values', 'application/json', 'text/plain', 'public.comma-separated-values-text', '*/*'], copyToCacheDirectory: true, multiple: false });
  if (!res || res.canceled || !res.assets || !res.assets.length) return null;
  const a = res.assets[0];
  if (web && a.file && a.file.text) return a.file.text();
  return new File(a.uri).text();
}

// 'saved' (shared or downloaded), 'declined' (the share sheet was closed), or 'failed'.
export async function saveFile(name, data, type) {
  if (web) {
    try {
      const url = URL.createObjectURL(new Blob([data], { type }));
      const a = document.createElement('a');
      a.href = url; a.download = name; a.style.display = 'none';
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60000);
      return 'saved';
    } catch (e) { return 'failed'; }
  }
  try {
    const f = new File(Paths.cache, name);
    if (f.exists) f.delete();
    f.create();
    f.write(data);
    if (!(await Sharing.isAvailableAsync())) return 'failed';
    await Sharing.shareAsync(f.uri, { mimeType: type, dialogTitle: name, UTI: type === 'text/csv' ? 'public.comma-separated-values-text' : 'public.json' });
    return 'saved';
  } catch (e) {
    return 'failed';
  }
}
