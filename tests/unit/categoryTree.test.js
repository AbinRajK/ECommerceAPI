const { buildTree } = require('../../src/services/category.service');
const { ORDER_TRANSITIONS, ORDER_STATUS } = require('../../src/config/constants');
const { roundMoney } = require('../../src/utils/helpers');

describe('buildTree', () => {
  const cats = [
    { _id: 'e', name: 'Electronics', parent: null },
    { _id: 'm', name: 'Mobiles', parent: 'e' },
    { _id: 'a', name: 'Android', parent: 'm' },
    { _id: 's', name: 'Samsung', parent: 'a' },
    { _id: 'c', name: 'Computers', parent: 'e' },
    { _id: 'f', name: 'Fashion', parent: null },
  ];

  it('nests categories to any depth', () => {
    const tree = buildTree(cats);
    expect(tree.map((n) => n.name)).toEqual(['Electronics', 'Fashion']);
    const electronics = tree[0];
    expect(electronics.children.map((n) => n.name)).toEqual(['Mobiles', 'Computers']);
    expect(electronics.children[0].children[0].children[0].name).toBe('Samsung');
  });

  it('skips orphans whose parent is missing (e.g. inactive parent)', () => {
    const tree = buildTree(cats.filter((c) => c._id !== 'm'));
    const names = JSON.stringify(tree);
    expect(names).not.toContain('Android');
    expect(names).not.toContain('Samsung');
  });
});

describe('order status transitions', () => {
  it('terminal states have no outgoing transitions', () => {
    expect(ORDER_TRANSITIONS[ORDER_STATUS.DELIVERED]).toEqual([]);
    expect(ORDER_TRANSITIONS[ORDER_STATUS.CANCELLED]).toEqual([]);
  });

  it('cannot cancel once shipped', () => {
    expect(ORDER_TRANSITIONS[ORDER_STATUS.SHIPPED]).not.toContain(ORDER_STATUS.CANCELLED);
  });
});

describe('roundMoney', () => {
  it('avoids floating point drift', () => {
    expect(roundMoney(0.1 * 3)).toBe(0.3);
    expect(roundMoney(19.999 * 3)).toBe(60);
  });
});
