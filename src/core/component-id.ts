const segment = /^[a-z][a-z0-9-]{0,23}$/;
const entity = /^[a-zA-Z0-9_-]{1,40}$/;
export interface ComponentRoute { module: string; action: string; entityId?: string }
export function componentId(module: string, action: string, entityId?: string): string {
  if (!segment.test(module) || !segment.test(action) || (entityId !== undefined && !entity.test(entityId))) {
    throw new Error('Invalid component route');
  }
  const id = ['y1', module, action, ...(entityId === undefined ? [] : [entityId])].join(':');
  if (id.length > 100) throw new Error('Component ID exceeds 100 characters');
  return id;
}
export function parseComponentId(id: string): ComponentRoute | null {
  if (id.length > 100) return null;
  const parts = id.split(':');
  const [version, module, action, entityId] = parts;
  if (version !== 'y1' || !module || !action || parts.length < 3 || parts.length > 4) return null;
  if (!segment.test(module) || !segment.test(action) || (entityId !== undefined && !entity.test(entityId))) return null;
  return entityId === undefined ? { module, action } : { module, action, entityId };
}
