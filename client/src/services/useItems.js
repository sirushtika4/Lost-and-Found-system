import { useEffect, useState } from 'react';
import { itemService } from './itemService';
// Serialized parameters keep effects stable; cleanup prevents older responses winning races.
export function useItems(params = {}, mine = false) {
  const key = JSON.stringify(params);
  const [state, setState] = useState({ items: [], pagination: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        const response = await (mine ? itemService.getMyItems : itemService.getItems)(JSON.parse(key));
        if (active) setState({ ...response, key, version, loading: false, error: '' });
      } catch (error) { if (active) setState({ items: [], pagination: null, key, version, loading: false, error: error.message }); }
    }, 250);
    return () => { active = false; clearTimeout(timer); };
  }, [key, mine, version]);
  return { ...(state.key === key && state.version === version ? state : { items: [], pagination: null, loading: true, error: '' }), retry: () => setVersion(value => value + 1) };
}
export function useItem(id) {
  const [state, setState] = useState({ item: null, loading: true, error: '' });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    itemService.getItemById(id).then(response => {
      if (active) setState({ item: response.item, id, version, loading: false, error: '' });
    }).catch(error => { if (active) setState({ item: null, id, version, loading: false, error: error.message }); });
    return () => { active = false; };
  }, [id, version]);
  return { ...(state.id === id && state.version === version ? state : { item: null, loading: true, error: '' }), retry: () => setVersion(value => value + 1) };
}
