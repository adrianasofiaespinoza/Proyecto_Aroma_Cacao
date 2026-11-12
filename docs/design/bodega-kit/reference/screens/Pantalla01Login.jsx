// @card height=900 width=1760 subtitle="Formulario centrado y grande sobre el color de navegación. Móvil con error de credenciales."
import { B, BRAND, Devices, render } from './_kit.jsx';
const { Button, Field, TextInput, Checkbox, Notice, IconButton } = B;
function Login({ error }) {
  const k = error ? 1 : 0;
  return (
    <div className="lg">
      <form className="lg-form" onSubmit={e => e.preventDefault()}>
        <div className="lg-brand"><span className="lg-co">{BRAND.shortName}</span><span className="lg-prod">Bodega de mantenimiento</span></div>
        <div className="lg-panel">
          <h1>Iniciar sesión</h1>
          <p className="lg-sub">Usa el correo que te asignó el coordinador de mantenimiento.</p>
          {error && <Notice tone="danger" title="Correo o contraseña incorrectos">Revisa los datos e inténtalo de nuevo. Tras 5 intentos la cuenta se bloquea 15 minutos.</Notice>}
          <Field label="Correo" htmlFor={'em' + k}><TextInput id={'em' + k} icon="envelope" type="email" autoComplete="username" defaultValue={error ? 'lcedeno@aromacacao.ec' : ''} placeholder="nombre@empresa.ec" /></Field>
          <Field label="Contraseña" htmlFor={'pw' + k} error={error ? 'La contraseña no coincide con este correo.' : null}>
            <div className="lg-pw"><TextInput id={'pw' + k} icon="lock" type="password" autoComplete="current-password" defaultValue={error ? 'cacao2025' : ''} /><IconButton icon="eye" label="Mostrar contraseña" /></div>
          </Field>
          <Checkbox label="Recordarme en este equipo" defaultChecked={!error} />
          <Button variant="primary" size="xl" block icon="box-arrow-right" type="submit">Entrar</Button>
          <p className="lg-help">¿Olvidaste la contraseña? Pídele al coordinador que la restablezca.</p>
        </div>
        <span className="lg-foot">Bodega v1.0 · {BRAND.name}</span>
      </form>
    </div>
  );
}
render(<Devices desktop={<Login />} mobile={<Login error />} mRole="Error de credenciales" />);
