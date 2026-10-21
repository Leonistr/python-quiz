importScripts('https://cdn.jsdelivr.net/pyodide/v0.26.4/full/pyodide.js');
const RUNNER = `
import io, contextlib, traceback, builtins
def __noinput(*a):
    raise RuntimeError('input() в этих задачах не используется')
def __run(code, tests):
    ns={'input': __noinput}; buf=io.StringIO(); ok=None; msg=''
    try:
        with contextlib.redirect_stdout(buf): exec(code, ns)
        if tests is not None:
            ns['OUT']=buf.getvalue(); exec(tests, ns); ok=True
    except AssertionError as e:
        ok=False; msg='Тест не пройден' + (': '+str(e) if str(e) else '')
    except Exception:
        ok=False; msg=traceback.format_exc(limit=0)
    return [buf.getvalue()[:20000], ok, msg]
`;
const ready = loadPyodide().then(py => { py.runPython(RUNNER); self.py = py; postMessage({ ready: true }); });
onmessage = async e => {
  await ready;
  const { id, code, tests } = e.data;
  const f = py.globals.get('__run');
  const r = f(code, tests == null ? null : tests).toJs(); f.destroy();
  postMessage({ id, out: r[0], ok: r[1], msg: r[2] });
};
