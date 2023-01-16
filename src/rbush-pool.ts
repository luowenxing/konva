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
  private rNodes: Map<number, RNode> = new Map();

  public constructor() {}

  public add(item: RNode) {
    this.rNodes.set(item.id, item);
  }

  public delete(id: number) {
    this.rNodes.delete(id);
  }

  public clear() {
    this.rNodes.clear();
  }

  public get(id: number) {
    return this.rNodes.get(id);
  }

  public search(rect: BoundaryRect): RNode[] {
    const { minX, maxX, minY, maxY } = rect;
    const results: RNode[] = [];

    for (const rNode of this.rNodes.values()) {
      if (minX >= rNode.minX && maxX <= rNode.maxX && minY >= rNode.minY && maxY <= rNode.maxY) {
        results.push(rNode);
      }
    }

    return results;
  }

  public update(item: RNode) {
    const rNode = this.rNodes.get(item.id);
    if (rNode) {
      this.rNodes.set(item.id, item);
    }
  }
}

export default new RBushPool();