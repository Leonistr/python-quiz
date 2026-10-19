let py=null, editors=[], student={};
const statusEl=document.getElementById('status');
const pyReady=loadPyodide().then(p=>{py=p;statusEl.textContent='Python готов ✔';}).catch(e=>statusEl.textContent='Ошибка загрузки Python: '+e);
const RUNNER=`
import io, contextlib, traceback
def __run(code, tests):
    ns={}; buf=io.StringIO(); ok=None; msg=''
    try:
        with contextlib.redirect_stdout(buf): exec(code, ns)
        if tests is not None:
            ns['OUT']=buf.getvalue(); exec(tests, ns); ok=True
    except AssertionError as e:
        ok=False; msg='Тест не пройден' + (': '+str(e) if str(e) else '')
    except Exception:
        ok=False; msg=traceback.format_exc(limit=0)
    return buf.getvalue(), ok, msg
`;
async function runCode(code,tests){await pyReady; if(!py) throw 'Python не загружен';
  py.runPython(RUNNER); const f=py.globals.get('__run'); const r=f(code,tests===undefined?null:tests).toJs(); f.destroy(); return r;}
document.getElementById('start').onclick=()=>{
  const fio=document.getElementById('fio').value.trim(), group=document.getElementById('group').value.trim();
  if(!fio||!group){document.getElementById('loginErr').textContent='Заполните ФИО и группу';return;}
  student={fio,group}; document.getElementById('login').hidden=true; buildQuiz();};
function buildQuiz(){const q=document.getElementById('quiz'); q.hidden=false; document.getElementById('finishBox').hidden=false;
  TASKS.forEach((t,i)=>{const c=document.createElement('div');c.className='card';
    c.innerHTML=`<h3>Задача ${t.id}. ${t.title}</h3><p>${t.desc}</p><textarea></textarea>
    <button class="run">Запустить</button><button class="chk">Проверить</button><span class="st"></span><pre class="out"></pre>`;
    q.appendChild(c);
    const ed=CodeMirror.fromTextArea(c.querySelector('textarea'),{mode:'python',lineNumbers:true,indentUnit:4,
      extraKeys:{Tab:cm=>cm.replaceSelection('    '),'Shift-Tab':'indentLess'}});
    ed.setValue(t.starter); editors.push(ed);
    const out=c.querySelector('.out'), st=c.querySelector('.st');
    c.querySelector('.run').onclick=async()=>{out.textContent='…';try{const[o,,m]=await runCode(ed.getValue());out.textContent=o+(m?'\n'+m:'');}catch(e){out.textContent=e}};
    c.querySelector('.chk').onclick=async()=>{try{const[o,ok,m]=await runCode(ed.getValue(),t.tests);out.textContent=o+(m?'\n'+m:'');
      st.className='st '+(ok?'ok':'bad');st.textContent=ok?' ✔ Верно':' ✘ Неверно';}catch(e){out.textContent=e}};
  });}
document.getElementById('finish').onclick=async()=>{
  if(!confirm('Завершить работу и отправить результаты? Изменить ответы будет нельзя.'))return;
  const btn=document.getElementById('finish'); btn.disabled=true; const res=document.getElementById('result'); res.textContent='Проверка…';
  const results=[]; let score=0;
  for(let i=0;i<TASKS.length;i++){const code=editors[i].getValue(); let ok=false;
    try{ok=!!(await runCode(code,TASKS[i].tests))[1];}catch(e){}
    if(ok)score++; results.push({id:TASKS[i].id,passed:ok?1:0,code});}
  const payload={fio:student.fio,group:student.group,timestamp:new Date().toISOString(),score,total:TASKS.length,results};
  editors.forEach(e=>e.setOption('readOnly',true));
  try{await fetch(APPS_SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(payload)});
    res.innerHTML=`<p class="ok">Результаты отправлены. Ваш балл: ${score} из ${TASKS.length}</p>`;}
  catch(e){res.innerHTML=`<p class="err">Не удалось отправить (${e}). Балл: ${score}/${TASKS.length}. Сообщите преподавателю.</p>`;btn.disabled=false;}
};
