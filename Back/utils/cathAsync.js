module.exports = (fn) => {
  return (req, res, next) => {
    // envuelvo la funcion asincronica en una funcion que le pasa a la proxima funcion en la cola de middleware el error
    fn(req, res, next).catch(next);
  };
};
