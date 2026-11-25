import { type MapLayerSettings, MapView } from '@ein/ui/components';
import { parseMapPosition } from '@ein/ui/lib';
import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

/** Each layer's settings out of the card's query, where they are `<layer>/<setting>`; a setting given more than once is a list. */
const layerSettingsOf = (params: URLSearchParams): Record<string, MapLayerSettings> => {
  const settings: Record<string, Record<string, string[]>> = {};
  for (const [key, value] of params) {
    const at = key.indexOf('/');
    if (at < 1) continue;
    const [layer, name] = [key.slice(0, at), key.slice(at + 1)];
    ((settings[layer] ??= {})[name] ??= []).push(value);
  }
  return settings;
};

/**
 * `/cards/dashboard/map`: a map in a `style` (the viewer's own when none), with `layers` drawn on it,
 * each with its own settings (`<layer>/<setting>`), looking at `position` (`lat, lng, zoom`) or,
 * without one, fitted to what its layers show, such as the stops a layer draws. `controls` names the
 * buttons drawn over it: `style` and `layers` pickers, whose picks last until the card is drawn
 * again, and `fullscreen`, which enlarges it over the dashboard.
 */
export default function MapCard() {
  const [params] = useSearchParams();
  // A change of settings draws the card anew, from them.
  return <CardMap key={params.toString()} params={params} />;
}

function CardMap({ params }: { params: URLSearchParams }) {
  const position = parseMapPosition(params.get('position') ?? '');
  const controls = new Set(params.getAll('controls'));
  const layers = useMemo(() => params.getAll('layers'), [params]);
  const layerSettings = useMemo(() => layerSettingsOf(params), [params]);
  const [style, setStyle] = useState(params.get('style') || undefined);
  return (
    <MapView
      center={position ? { lat: position.lat, lng: position.lng } : undefined}
      zoom={position?.zoom}
      fit={!position}
      mapStyle={style}
      onMapStyleChange={setStyle}
      defaultLayers={layers}
      layerSettings={layerSettings}
      controls={{ style: controls.has('style'), layers: controls.has('layers'), fullscreen: controls.has('fullscreen') }}
      style={{ height: '100%', width: '100%', minHeight: 0 }}
    />
  );
}
