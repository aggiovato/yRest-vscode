// Mismo patrón en JS puro

const fixture = yrest`
  _rel:
    orders:
      userId: "m2o:users[1..1->0..n]+nested"
      statusId: "many2one:statuses[1..1->0..n]+nested"
    items:
      orderId:
        _type: many2one
        _target: orders
        _foreignKey: orderId
        _car-direct: 1..1
        _car-inverse: 0..n
        _nested: false

  _routes:
    - method: GET
      path: /orders/:id/summary
      response:
        status: 200
        body:
          orderId: "{{params.id}}"
          fetchedAt: "{{now}}"
          ref: "{{uuid}}"

  users:
    - id: 1
      name: Test User

  statuses:
    - id: 1
      label: pending
    - id: 2
      label: delivered

  orders:
    - id: 1
      userId: 1
      statusId: 1
      total: 59.90

  items:
    - id: 1
      orderId: 1
      product: Notebook
      qty: 1
`;

module.exports = { fixture };
