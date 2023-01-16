import RBush from 'rbush';

type BoundaryRect = {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
};

interface RNode extends BoundaryRect {
  id: number;
  hasActionKey: boolean;
}

class RBushPool {
  private rbush: RBush<RNode>;
  private rNodes = new Map<number, RNode>();

  public constructor() {
    this.rbush = new RBush();
  }

  public add(item: RNode) {
    this.rbush.insert(item);
    this.rNodes.set(item.id, item);
  }

  public delete(id: number) {
    const node = this.rNodes.get(id);
    if (node) {
      this.rbush.remove(node);
    }
    this.rNodes.delete(id);
  }

  public clear() {
    this.rbush.clear();
  }

  public search(rect: BoundaryRect): RNode[] {
    return this.rbush.search(rect);
  }

  public update(item: RNode) {
    this.delete(item.id);
    this.add(item);
  }

  public get(id: number) {
    return this.rNodes.get(id);
  }
}

export default new RBushPool();