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
  private rNodes: RNode[] = [];

  public constructor() {}

  public add(item: RNode) {
    this.rNodes.push(item);
  }

  public delete(id: number) {
    const index = this.rNodes.findIndex(rNode => rNode.id === id);
    this.rNodes.splice(index, 1);
  }

  public clear() {
    this.rNodes = [];
  }

  public search(rect: BoundaryRect): RNode[] {
    const { minX, maxX, minY, maxY } = rect;
    return this.rNodes.filter(rNode => minX >= rNode.minX && maxX <= rNode.maxX && minY >= rNode.minY && maxY <= rNode.maxY);
  }

  public update(item: RNode) {
    const index = this.rNodes.findIndex(rNode => rNode.id === item.id);
    if (index > -1) {
      this.rNodes[index] = item;
    }
  }
}

export default new RBushPool();