import { fsaDriver } from '@/lib/storage/storage';
import { Button } from '@/components/ui/button';

export function StorageSection() {
  const isIdbOnly = fsaDriver === null;

  const handleChangeFolder = async () => {
    if (!fsaDriver) return;
    try {
      await fsaDriver.requestPermission();
      window.location.reload();
    } catch (e) {
      // AbortError = user cancelled picker — do nothing
      if (e instanceof DOMException && e.name === 'AbortError') return;
      throw e;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-sm font-semibold mb-1">Storage mode</h2>
        {isIdbOnly ? (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">Browser storage (IndexedDB)</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Your data is stored in this browser only. It will not appear in other browsers or
              devices, and may be cleared if you clear site data. This browser does not support
              the File System Access API (Chrome or Edge required for file storage).
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              <span className="font-medium text-foreground">File storage (File System Access API)</span>
            </p>
            <p className="text-sm text-muted-foreground">
              Your data is saved as JSON files in the folder you chose. You can change the folder at
              any time — the app will reload after you pick a new location.
            </p>
            <Button variant="outline" size="sm" onClick={handleChangeFolder}>
              Change folder
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
