/** UTF-8 text from Windows editors may start with one BOM; values stay intact. */
export function parseUtf8Json(text){
  if(typeof text!=='string')throw new Error('請提供 UTF-8 JSON 文字。');
  return JSON.parse(text.replace(/^\ufeff/,''));
}
