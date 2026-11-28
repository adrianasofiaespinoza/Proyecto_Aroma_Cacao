import { useState } from 'react'
import { Button, Checkbox, Icon, Notice } from '../../components/ui'

/**
 * Código de recuperación recién generado. Se muestra una sola vez: con él la persona
 * elige una contraseña nueva desde el login, sin depender del coordinador.
 */
export function RecoveryCodeView({ code, doneLabel = 'Continuar', onDone }: { code: string; doneLabel?: string; onDone: () => void }) {
  const [saved, setSaved] = useState(false)
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch {
      /* sin permiso de portapapeles: el código sigue visible para anotarlo */
    }
  }

  const download = () => {
    const text = `Código de recuperación de la bodega\n\n${code}\n\nSirve una sola vez. En el inicio de sesión pulsa «¿Olvidaste la contraseña?» y escribe tu correo y este código.\n`
    const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = 'codigo-recuperacion-bodega.txt'
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="bd-stack rc">
      <Notice tone="pending" title="Guarda tu código de recuperación">
        Si olvidas tu contraseña, con este código eliges una nueva tú mismo, sin pedírsela al coordinador.
        <b> Solo se muestra esta vez.</b> Anótalo en papel o guárdalo en tu celular, y no lo compartas.
      </Notice>
      <output className="rc-code bd-mono" aria-label="Código de recuperación">{code}</output>
      <div className="bd-row rc-actions">
        <Button variant="secondary" icon={copied ? 'check-lg' : 'clipboard-check'} onClick={() => void copy()}>{copied ? 'Copiado' : 'Copiar'}</Button>
        <Button variant="secondary" icon="box-arrow-in-down" onClick={download}>Descargar .txt</Button>
      </div>
      <p className="bd-muted rc-note"><Icon name="info-circle" /> Sirve una sola vez. Cuando lo uses, el sistema te dará uno nuevo.</p>
      <Checkbox label="Ya guardé mi código" checked={saved} onChange={(e) => setSaved(e.target.checked)} />
      <Button variant="primary" size="lg" icon="check-lg" disabled={!saved} onClick={onDone}>{doneLabel}</Button>
    </div>
  )
}
