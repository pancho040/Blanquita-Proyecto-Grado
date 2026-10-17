CREATE OR REPLACE FUNCTION public."AbrirBobinaServilleta"(p_idbobinaservilleta integer, p_idusuario integer, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdBobinaServilleta" integer, "IdEstadoMateriaPrima" integer, "CantidadSubBobinas435" integer, "CantidadSubBobinas220" integer, "CantidadSubBobinasTotal" integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoActual         INTEGER;
  v_IdEstadoAlmacenBobina  CONSTANT INTEGER := 1;
  v_IdEstadoAbierta        CONSTANT INTEGER := 6;
  v_IdEstadoAlmacenSub     CONSTANT INTEGER := 1;
  v_IdTipoMovimientoIngreso CONSTANT INTEGER := 1;
  v_IdTipoMovimientoApertura CONSTANT INTEGER := 2;
  v_IdTipoMedida435        INTEGER;
  v_IdTipoMedida220        INTEGER;
  v_unidad                 RECORD;
  v_i                      INTEGER;
  v_Cantidad435            INTEGER;
  v_Cantidad220            INTEGER;
  v_TotalSub435            INTEGER := 0;
  v_TotalSub220            INTEGER := 0;
  v_IdSubBobina            INTEGER;
BEGIN
  SELECT bs."IdEstadoMateriaPrima" INTO v_IdEstadoActual
  FROM "BobinaServilleta" AS bs
  WHERE bs."IdBobinaServilleta" = p_IdBobinaServilleta
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la BobinaServilleta con IdBobinaServilleta = %', p_IdBobinaServilleta;
  END IF;

  IF v_IdEstadoActual <> v_IdEstadoAlmacenBobina THEN
    RAISE EXCEPTION 'La BobinaServilleta % no está En almacén (estado actual: %), no puede abrirse', p_IdBobinaServilleta, v_IdEstadoActual;
  END IF;

  SELECT tm."IdTipoMedidaSubBobina" INTO v_IdTipoMedida435
  FROM "TipoMedidaSubBobina" AS tm WHERE tm."MedidaMm" = 435 LIMIT 1;

  SELECT tm."IdTipoMedidaSubBobina" INTO v_IdTipoMedida220
  FROM "TipoMedidaSubBobina" AS tm WHERE tm."MedidaMm" = 220 LIMIT 1;

  IF v_IdTipoMedida435 IS NULL OR v_IdTipoMedida220 IS NULL THEN
    RAISE EXCEPTION 'No se encontraron los tipos de medida de sub-bobina (435/220) en TipoMedidaSubBobina.';
  END IF;

  UPDATE "BobinaServilleta" AS bs
  SET "IdEstadoMateriaPrima" = v_IdEstadoAbierta
  WHERE bs."IdBobinaServilleta" = p_IdBobinaServilleta;

  INSERT INTO "MovimientoBobinaServilleta" (
    "IdBobinaServilleta", "IdTipoMovimiento", "IdUsuario", "Observacion"
  ) VALUES (
    p_IdBobinaServilleta,
    v_IdTipoMovimientoApertura,
    p_IdUsuario,
    COALESCE(p_Observacion, 'Apertura de BobinaServilleta #' || p_IdBobinaServilleta)
  );

  FOR v_unidad IN
    SELECT
      ub."IdUnidadBobinaServilleta",
      fsb."CantidadBobina435",
      fsb."CantidadBobina220"
    FROM "UnidadBobinaServilleta" AS ub
    INNER JOIN "FormatoSubBobina" AS fsb
      ON fsb."IdFormatoSubBobina" = ub."IdFormatoSubBobina"
    WHERE ub."IdBobinaServilleta" = p_IdBobinaServilleta
    FOR UPDATE OF ub
  LOOP
    v_Cantidad435 := COALESCE(v_unidad."CantidadBobina435", 0);
    v_Cantidad220 := COALESCE(v_unidad."CantidadBobina220", 0);

    FOR v_i IN 1..v_Cantidad435 LOOP
      INSERT INTO "SubBobinaServilleta" AS sb (
        "IdUnidadBobinaServilleta",
        "IdTipoMedidaSubBobina",
        "IdEstadoMateriaPrima"
      ) VALUES (
        v_unidad."IdUnidadBobinaServilleta",
        v_IdTipoMedida435,
        v_IdEstadoAlmacenSub
      )
      RETURNING sb."IdSubBobinaServilleta" INTO v_IdSubBobina;

      INSERT INTO "MovimientoSubBobina" (
        "IdSubBobinaServilleta", "IdTipoMovimiento", "IdUsuario", "Observacion"
      ) VALUES (
        v_IdSubBobina,
        v_IdTipoMovimientoIngreso,
        p_IdUsuario,
        COALESCE(p_Observacion, 'Generada por apertura de BobinaServilleta #' || p_IdBobinaServilleta)
      );

      v_TotalSub435 := v_TotalSub435 + 1;
    END LOOP;

    FOR v_i IN 1..v_Cantidad220 LOOP
      INSERT INTO "SubBobinaServilleta" AS sb (
        "IdUnidadBobinaServilleta",
        "IdTipoMedidaSubBobina",
        "IdEstadoMateriaPrima"
      ) VALUES (
        v_unidad."IdUnidadBobinaServilleta",
        v_IdTipoMedida220,
        v_IdEstadoAlmacenSub
      )
      RETURNING sb."IdSubBobinaServilleta" INTO v_IdSubBobina;

      INSERT INTO "MovimientoSubBobina" (
        "IdSubBobinaServilleta", "IdTipoMovimiento", "IdUsuario", "Observacion"
      ) VALUES (
        v_IdSubBobina,
        v_IdTipoMovimientoIngreso,
        p_IdUsuario,
        COALESCE(p_Observacion, 'Generada por apertura de BobinaServilleta #' || p_IdBobinaServilleta)
      );

      v_TotalSub220 := v_TotalSub220 + 1;
    END LOOP;
  END LOOP;

  RETURN QUERY
  SELECT
    p_IdBobinaServilleta,
    v_IdEstadoAbierta,
    v_TotalSub435,
    v_TotalSub220,
    v_TotalSub435 + v_TotalSub220;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."AjusteNegativoInventarioProductoTerminado"(p_idpresentacion integer, p_idusuario integer, p_cantidad numeric, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdPresentacion" integer, "CodigoPresentacion" text, "NombreProducto" text, "CantidadAjustada" numeric, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdTipoMovimientoAjusteNegativo CONSTANT INTEGER := 6;
  v_CantidadDisponible NUMERIC;
  v_CantidadActual      NUMERIC;
BEGIN
  IF p_Cantidad IS NULL OR p_Cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad debe ser mayor a 0.';
  END IF;

  SELECT ipt."CantidadActual" INTO v_CantidadDisponible
  FROM "InventarioProductoTerminado" AS ipt
  WHERE ipt."IdPresentacion" = p_IdPresentacion
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe inventario registrado para IdPresentacion = %', p_IdPresentacion;
  END IF;

  IF v_CantidadDisponible < p_Cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente para IdPresentacion = % (disponible: %, solicitado: %)', p_IdPresentacion, v_CantidadDisponible, p_Cantidad;
  END IF;

  INSERT INTO "MovimientoProductoTerminado" (
    "IdTipoMovimientoInventario",
    "IdPresentacion",
    "IdUsuario",
    "CantidadIngresoInventario",
    "Observacion"
  ) VALUES (
    c_IdTipoMovimientoAjusteNegativo,
    p_IdPresentacion,
    p_IdUsuario,
    p_Cantidad,
    p_Observacion
  );

  UPDATE "InventarioProductoTerminado" AS ipt
  SET "CantidadActual" = ipt."CantidadActual" - p_Cantidad
  WHERE ipt."IdPresentacion" = p_IdPresentacion
  RETURNING ipt."CantidadActual" INTO v_CantidadActual;

  RETURN QUERY
  SELECT
    pp."IdPresentacion",
    pp."CodigoPresentacion",
    p."NombreProducto",
    p_Cantidad,
    v_CantidadActual
  FROM "PresentacionProducto" AS pp
  INNER JOIN "Producto" AS p ON p."IdProducto" = pp."IdProducto"
  WHERE pp."IdPresentacion" = p_IdPresentacion;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."AjustePositivoInventarioProductoTerminado"(p_idpresentacion integer, p_idusuario integer, p_cantidad numeric, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdPresentacion" integer, "CodigoPresentacion" text, "NombreProducto" text, "CantidadAjustada" numeric, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdTipoMovimientoAjustePositivo CONSTANT INTEGER := 5;
  v_CantidadActual NUMERIC;
BEGIN
  IF p_Cantidad IS NULL OR p_Cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad debe ser mayor a 0.';
  END IF;

  PERFORM 1 FROM "InventarioProductoTerminado" AS ipt
  WHERE ipt."IdPresentacion" = p_IdPresentacion
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe inventario registrado para IdPresentacion = %', p_IdPresentacion;
  END IF;

  INSERT INTO "MovimientoProductoTerminado" (
    "IdTipoMovimientoInventario",
    "IdPresentacion",
    "IdUsuario",
    "CantidadIngresoInventario",
    "Observacion"
  ) VALUES (
    c_IdTipoMovimientoAjustePositivo,
    p_IdPresentacion,
    p_IdUsuario,
    p_Cantidad,
    p_Observacion
  );

  UPDATE "InventarioProductoTerminado" AS ipt
  SET "CantidadActual" = ipt."CantidadActual" + p_Cantidad
  WHERE ipt."IdPresentacion" = p_IdPresentacion
  RETURNING ipt."CantidadActual" INTO v_CantidadActual;

  RETURN QUERY
  SELECT
    pp."IdPresentacion",
    pp."CodigoPresentacion",
    p."NombreProducto",
    p_Cantidad,
    v_CantidadActual
  FROM "PresentacionProducto" AS pp
  INNER JOIN "Producto" AS p ON p."IdProducto" = pp."IdProducto"
  WHERE pp."IdPresentacion" = p_IdPresentacion;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."CancelarProduccionBobinaTubo"(p_id_produccion integer, p_id_usuario integer, p_motivo_cancelacion text DEFAULT NULL::text)
 RETURNS TABLE("IdCancelacionProduccionBobinaTubo" integer, "IdProduccionBobinaTubo" integer, "FechaHoraCancelacion" timestamp with time zone, "MotivoCancelacion" text, "IdEstadoProduccion" integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_estado_actual                     INTEGER;
  v_IdBobina1                         INTEGER;
  v_IdBobina2                         INTEGER;
  v_IdEstadoFueraInventario           INTEGER := 5;
  v_IdTipoMovimientoFalla             INTEGER := 5;
  v_IdCancelacionProduccionBobinaTubo INTEGER;
  v_FechaHoraCancelacion              TIMESTAMPTZ;
BEGIN
  SELECT pbt."IdEstadoProduccion", pbt."IdBobina_1", pbt."IdBobina_2"
  INTO v_estado_actual, v_IdBobina1, v_IdBobina2
  FROM "ProduccionBobinaTubo" pbt
  WHERE pbt."IdProduccionBobinaTubo" = p_id_produccion
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la producción con ID %', p_id_produccion;
  END IF;

  IF v_estado_actual <> 2 THEN
    RAISE EXCEPTION 'La producción % no está en Pausa (estado actual: %), no se puede cancelar', p_id_produccion, v_estado_actual;
  END IF;

  UPDATE "ProduccionBobinaTubo" AS pbt
  SET "IdEstadoProduccion" = 4,
      "FechaFinProduccion" = now()
  WHERE pbt."IdProduccionBobinaTubo" = p_id_produccion;

  UPDATE "BobinaPapel"
  SET "IdEstadoMateriaPrima" = v_IdEstadoFueraInventario
  WHERE "IdBobinaPapel" IN (v_IdBobina1, v_IdBobina2);

  INSERT INTO "MovimientoBobina" ("IdBobinaPapel", "IdTipoMovimiento", "IdUsuario", "Observacion")
  SELECT b."IdBobinaPapel", v_IdTipoMovimientoFalla, p_id_usuario, 'Retiro por cancelación de producción - Bobina Tubo #' || p_id_produccion
  FROM "BobinaPapel" b
  WHERE b."IdBobinaPapel" IN (v_IdBobina1, v_IdBobina2);

  INSERT INTO "CancelacionProduccionBobinaTubo" AS cpbt (
    "IdProduccionBobinaTubo",
    "IdUsuario",
    "MotivoCancelacion"
  ) VALUES (
    p_id_produccion,
    p_id_usuario,
    p_motivo_cancelacion
  )
  RETURNING cpbt."IdCancelacionProduccionBobinaTubo", cpbt."FechaHoraCancelacion"
  INTO v_IdCancelacionProduccionBobinaTubo, v_FechaHoraCancelacion;

  RETURN QUERY
  SELECT
    v_IdCancelacionProduccionBobinaTubo,
    p_id_produccion,
    v_FechaHoraCancelacion,
    p_motivo_cancelacion,
    4;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."CancelarProduccionServilleta"(p_id_produccion integer, p_id_usuario integer, p_motivo_cancelacion text DEFAULT NULL::text)
 RETURNS TABLE("IdCancelacionProduccionServilleta" integer, "IdProduccionServilleta" integer, "FechaHoraCancelacion" timestamp with time zone, "MotivoCancelacion" text, "IdEstadoProduccion" integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_estado_actual                       INTEGER;
  v_IdSubBobina                         INTEGER;
  v_IdEstadoFueraInventario             INTEGER := 5;
  v_IdTipoMovimientoFalla               INTEGER := 5;
  v_IdCancelacionProduccionServilleta   INTEGER;
  v_FechaHoraCancelacion                TIMESTAMPTZ;
BEGIN
  SELECT ps."IdEstadoProduccion", ps."IdSubBobina"
  INTO v_estado_actual, v_IdSubBobina
  FROM "ProduccionServilleta" AS ps
  WHERE ps."IdProduccionServilleta" = p_id_produccion
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la producción con ID %', p_id_produccion;
  END IF;

  IF v_estado_actual <> 2 THEN
    RAISE EXCEPTION 'La producción % no está en Pausa (estado actual: %), no se puede cancelar', p_id_produccion, v_estado_actual;
  END IF;

  UPDATE "ProduccionServilleta" AS ps
  SET "IdEstadoProduccion" = 4,
      "FechaFinProduccion" = now()
  WHERE ps."IdProduccionServilleta" = p_id_produccion;

  UPDATE "SubBobinaServilleta" AS sb
  SET "IdEstadoMateriaPrima" = v_IdEstadoFueraInventario
  WHERE sb."IdSubBobinaServilleta" = v_IdSubBobina;

  INSERT INTO "MovimientoSubBobina" ("IdSubBobinaServilleta", "IdTipoMovimiento", "IdUsuario", "Observacion")
  VALUES (v_IdSubBobina, v_IdTipoMovimientoFalla, p_id_usuario, 'Retiro por cancelación de producción - Servilleta #' || p_id_produccion);

  INSERT INTO "CancelacionProduccionServilleta" AS cps (
    "IdProduccionServilleta",
    "IdUsuario",
    "MotivoCancelacion"
  ) VALUES (
    p_id_produccion,
    p_id_usuario,
    p_motivo_cancelacion
  )
  RETURNING cps."IdCancelacionProduccionServilleta", cps."FechaHoraCancelacion"
  INTO v_IdCancelacionProduccionServilleta, v_FechaHoraCancelacion;

  RETURN QUERY
  SELECT
    v_IdCancelacionProduccionServilleta,
    p_id_produccion,
    v_FechaHoraCancelacion,
    p_motivo_cancelacion,
    4;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."CorregirInventarioProductoTerminado"(p_idtipomovimientoinventario integer, p_idpresentacion integer, p_idusuario integer, p_cantidad numeric, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdPresentacion" integer, "CodigoPresentacion" text, "NombreProducto" text, "NombreTipoMovimientoInventario" text, "CantidadAplicada" numeric, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdDescuento       CONSTANT INTEGER := 3;
  c_IdAumento         CONSTANT INTEGER := 4;
  c_IdAjustePositivo  CONSTANT INTEGER := 5;
  c_IdAjusteNegativo  CONSTANT INTEGER := 6;
  v_Signo             INTEGER;
  v_CantidadDisponible NUMERIC;
  v_CantidadActual     NUMERIC;
BEGIN
  IF p_Cantidad IS NULL OR p_Cantidad <= 0 THEN
    RAISE EXCEPTION 'Cantidad debe ser mayor a 0.';
  END IF;

  IF p_IdTipoMovimientoInventario IN (c_IdAumento, c_IdAjustePositivo) THEN
    v_Signo := 1;
  ELSIF p_IdTipoMovimientoInventario IN (c_IdDescuento, c_IdAjusteNegativo) THEN
    v_Signo := -1;
  ELSE
    RAISE EXCEPTION 'IdTipoMovimientoInventario % no es un tipo de corrección válido para esta función.', p_IdTipoMovimientoInventario;
  END IF;

  SELECT ipt."CantidadActual" INTO v_CantidadDisponible
  FROM "InventarioProductoTerminado" AS ipt
  WHERE ipt."IdPresentacion" = p_IdPresentacion
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe inventario registrado para IdPresentacion = %', p_IdPresentacion;
  END IF;

  IF v_Signo = -1 AND v_CantidadDisponible < p_Cantidad THEN
    RAISE EXCEPTION 'Stock insuficiente para IdPresentacion = % (disponible: %, solicitado: %)', p_IdPresentacion, v_CantidadDisponible, p_Cantidad;
  END IF;

  INSERT INTO "MovimientoProductoTerminado" (
    "IdTipoMovimientoInventario",
    "IdPresentacion",
    "IdUsuario",
    "CantidadIngresoInventario",
    "Observacion"
  ) VALUES (
    p_IdTipoMovimientoInventario,
    p_IdPresentacion,
    p_IdUsuario,
    p_Cantidad,
    p_Observacion
  );

  UPDATE "InventarioProductoTerminado" AS ipt
  SET "CantidadActual" = ipt."CantidadActual" + (v_Signo * p_Cantidad)
  WHERE ipt."IdPresentacion" = p_IdPresentacion
  RETURNING ipt."CantidadActual" INTO v_CantidadActual;

  RETURN QUERY
  SELECT
    pp."IdPresentacion",
    pp."CodigoPresentacion",
    p."NombreProducto",
    tmi."NombreTipoMovimientoInventario",
    p_Cantidad,
    v_CantidadActual
  FROM "PresentacionProducto" AS pp
  INNER JOIN "Producto" AS p ON p."IdProducto" = pp."IdProducto"
  INNER JOIN "TipoMovimientoInventario" AS tmi ON tmi."IdTipoMovimientoInventario" = p_IdTipoMovimientoInventario
  WHERE pp."IdPresentacion" = p_IdPresentacion;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."CorregirTrasladoRodela"(p_idrodela integer, p_idusuario integer, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdRodela" integer, "CodigoRodela" text, "IdEstadoMateriaPrima" integer, "FechaMovimiento" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoActual  INTEGER;
  v_CodigoRodela    TEXT;
  v_FechaMovimiento TIMESTAMPTZ;
  c_IdEstadoAlmacen             CONSTANT INTEGER := 1;
  c_IdEstadoAbierta             CONSTANT INTEGER := 6;
  c_IdTipoMovimientoCorreccion  CONSTANT INTEGER := 6;  -- mapear en TipoMovimientoMateriaPrima (AplicaA 'Rodela')
BEGIN
  IF p_IdRodela IS NULL THEN
    RAISE EXCEPTION 'IdRodela es obligatorio para corregir el traslado.';
  END IF;

  SELECT r."IdEstadoMateriaPrima", r."CodigoRodela"
  INTO v_IdEstadoActual, v_CodigoRodela
  FROM "Rodela" r
  WHERE r."IdRodela" = p_IdRodela
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la rodela con IdRodela = %', p_IdRodela;
  END IF;

  IF v_IdEstadoActual <> c_IdEstadoAbierta THEN
    RAISE EXCEPTION 'La rodela % no está Abierta (estado actual: %), no puede corregirse el traslado', p_IdRodela, v_IdEstadoActual;
  END IF;

  UPDATE "Rodela" AS r
  SET "IdEstadoMateriaPrima" = c_IdEstadoAlmacen
  WHERE r."IdRodela" = p_IdRodela;

  INSERT INTO "MovimientoRodela" AS mr ("IdRodela", "IdTipoMovimiento", "IdUsuario", "Observacion")
  VALUES (p_IdRodela, c_IdTipoMovimientoCorreccion, p_IdUsuario,
          COALESCE(p_Observacion, 'Corrección por error humano - reingreso a almacén'))
  RETURNING mr."FechaMovimiento" INTO v_FechaMovimiento;

  RETURN QUERY
  SELECT p_IdRodela, v_CodigoRodela, c_IdEstadoAlmacen, v_FechaMovimiento;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."CrearUsuario"(p_idrol integer, p_idestadousuario integer, p_ci text, p_clave text, p_primernombre text, p_segundonombre text, p_apellidopaterno text, p_apellidomaterno text)
 RETURNS TABLE("IdUsuario" integer, "IdRol" integer, "NombreRol" text, "IdEstadoUsuario" integer, "NombreEstadoUsuario" text, "Ci" text, "PrimerNombre" text, "SegundoNombre" text, "ApellidoPaterno" text, "ApellidoMaterno" text, "FechaRegistro" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdUsuario INTEGER;
BEGIN
  IF p_Ci IS NULL OR LENGTH(TRIM(p_Ci)) < 8 THEN
    RAISE EXCEPTION 'El CI debe tener al menos 8 caracteres';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "Rol" r WHERE r."IdRol" = p_IdRol) THEN
    RAISE EXCEPTION 'El rol especificado no existe';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM "EstadoUsuario" eu WHERE eu."IdEstadoUsuario" = p_IdEstadoUsuario) THEN
    RAISE EXCEPTION 'El estado de usuario especificado no existe';
  END IF;

  BEGIN
    INSERT INTO "Usuario" AS us (
      "IdRol",
      "IdEstadoUsuario",
      "Ci",
      "Clave",
      "PrimerNombre",
      "SegundoNombre",
      "ApellidoPaterno",
      "ApellidoMaterno"
    ) VALUES (
      p_IdRol,
      p_IdEstadoUsuario,
      TRIM(p_Ci),
      p_Clave,
      p_PrimerNombre,
      p_SegundoNombre,
      p_ApellidoPaterno,
      p_ApellidoMaterno
    ) RETURNING us."IdUsuario" INTO v_IdUsuario;
  EXCEPTION
    WHEN unique_violation THEN
      RAISE EXCEPTION 'Ya existe un usuario registrado con el CI %', p_Ci;
  END;

  RETURN QUERY
  SELECT
    u."IdUsuario",
    u."IdRol",
    r."NombreRol",
    u."IdEstadoUsuario",
    eu."NombreEstadoUsuario",
    u."Ci",
    u."PrimerNombre",
    u."SegundoNombre",
    u."ApellidoPaterno",
    u."ApellidoMaterno",
    u."FechaRegistro"
  FROM "Usuario" u
  JOIN "Rol" r ON r."IdRol" = u."IdRol"
  JOIN "EstadoUsuario" eu ON eu."IdEstadoUsuario" = u."IdEstadoUsuario"
  WHERE u."IdUsuario" = v_IdUsuario;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."CrearUsuario"(p_authuserid uuid, p_idrol integer, p_ci text, p_primernombre text, p_apellidopaterno text, p_celular text, p_segundonombre text DEFAULT NULL::text, p_apellidomaterno text DEFAULT NULL::text, p_isadmin boolean DEFAULT false)
 RETURNS TABLE("IdUsuarioOut" integer, "AuthUserIdOut" uuid, "CiOut" text, "IdRolOut" integer, "NombreRolOut" text, "IdEstadoUsuarioOut" integer, "NombreCompletoOut" text, "CelularOut" text, "IsAdminOut" boolean, "FechaRegistroOut" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
    c_EstadoUsuarioActivo CONSTANT INTEGER := 1;
    v_Ci                  TEXT;
    v_Celular             TEXT;
    v_PrimerNombre        TEXT;
    v_ApellidoPaterno     TEXT;
    v_IdUsuario           INTEGER;
BEGIN
    v_Ci              := NULLIF(BTRIM(p_Ci), '');
    v_Celular         := NULLIF(BTRIM(p_Celular), '');
    v_PrimerNombre    := NULLIF(BTRIM(p_PrimerNombre), '');
    v_ApellidoPaterno := NULLIF(BTRIM(p_ApellidoPaterno), '');

    IF p_AuthUserId IS NULL THEN
        RAISE EXCEPTION 'El identificador de autenticación es obligatorio'
            USING ERRCODE = '22023';
    END IF;

    IF v_Ci IS NULL THEN
        RAISE EXCEPTION 'El CI es obligatorio'
            USING ERRCODE = '22023';
    END IF;

    IF v_PrimerNombre IS NULL THEN
        RAISE EXCEPTION 'El primer nombre es obligatorio'
            USING ERRCODE = '22023';
    END IF;

    IF v_ApellidoPaterno IS NULL THEN
        RAISE EXCEPTION 'El apellido paterno es obligatorio'
            USING ERRCODE = '22023';
    END IF;

    IF v_Celular IS NULL THEN
        RAISE EXCEPTION 'El número de celular es obligatorio'
            USING ERRCODE = '22023';
    END IF;

    IF v_Celular !~ '^[67][0-9]{7}$' THEN
        RAISE EXCEPTION 'El número de celular debe tener 8 dígitos e iniciar en 6 o 7'
            USING ERRCODE = '22023';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM public."Rol" r WHERE r."IdRol" = p_IdRol
    ) THEN
        RAISE EXCEPTION 'El rol indicado no existe'
            USING ERRCODE = '23503';
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM auth."users" au WHERE au."id" = p_AuthUserId
    ) THEN
        RAISE EXCEPTION 'La cuenta de autenticación no existe'
            USING ERRCODE = '23503';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public."Usuario" u WHERE u."Ci" = v_Ci
    ) THEN
        RAISE EXCEPTION 'Ya existe un usuario registrado con el CI %', v_Ci
            USING ERRCODE = '23505';
    END IF;

    IF EXISTS (
        SELECT 1 FROM public."Usuario" u WHERE u."AuthUserId" = p_AuthUserId
    ) THEN
        RAISE EXCEPTION 'La cuenta de autenticación ya está vinculada a otro usuario'
            USING ERRCODE = '23505';
    END IF;

    INSERT INTO public."Usuario" (
        "AuthUserId",
        "IdRol",
        "IdEstadoUsuario",
        "Ci",
        "PrimerNombre",
        "SegundoNombre",
        "ApellidoPaterno",
        "ApellidoMaterno",
        "Celular",
        "IsAdmin"
    )
    VALUES (
        p_AuthUserId,
        p_IdRol,
        c_EstadoUsuarioActivo,
        v_Ci,
        v_PrimerNombre,
        NULLIF(BTRIM(p_SegundoNombre), ''),
        v_ApellidoPaterno,
        NULLIF(BTRIM(p_ApellidoMaterno), ''),
        v_Celular,
        COALESCE(p_IsAdmin, FALSE)
    )
    RETURNING "IdUsuario" INTO v_IdUsuario;

    RETURN QUERY
    SELECT
        u."IdUsuario",
        u."AuthUserId",
        u."Ci",
        u."IdRol",
        r."NombreRol",
        u."IdEstadoUsuario",
        BTRIM(CONCAT_WS(' ',
            u."PrimerNombre", u."SegundoNombre",
            u."ApellidoPaterno", u."ApellidoMaterno")),
        u."Celular",
        u."IsAdmin",
        u."FechaRegistro"
      FROM public."Usuario" u
      JOIN public."Rol" r ON r."IdRol" = u."IdRol"
     WHERE u."IdUsuario" = v_IdUsuario;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."DarDeBajaBobina"(p_idbobinapapel integer, p_idusuario integer, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdBobinaPapel" integer, "IdEstadoMateriaPrima" integer, "FechaMovimiento" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoActual          INTEGER;
  v_IdEstadoFueraInventario INTEGER := 5;
  v_IdEstadoBaja            INTEGER := 4;
  v_IdTipoMovimientoBaja    INTEGER := 4;
  v_FechaMovimiento         TIMESTAMPTZ;
BEGIN
  SELECT bp."IdEstadoMateriaPrima" INTO v_IdEstadoActual
  FROM "BobinaPapel" bp
  WHERE bp."IdBobinaPapel" = p_IdBobinaPapel
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la bobina con IdBobinaPapel = %', p_IdBobinaPapel;
  END IF;

  IF v_IdEstadoActual <> v_IdEstadoFueraInventario THEN
    RAISE EXCEPTION 'La bobina % no está Fuera de Inventario (estado actual: %), no puede darse de baja', p_IdBobinaPapel, v_IdEstadoActual;
  END IF;

  UPDATE "BobinaPapel" AS bp
  SET "IdEstadoMateriaPrima" = v_IdEstadoBaja
  WHERE bp."IdBobinaPapel" = p_IdBobinaPapel;

  INSERT INTO "MovimientoBobina" AS mb ("IdBobinaPapel", "IdTipoMovimiento", "IdUsuario", "Observacion")
  VALUES (p_IdBobinaPapel, v_IdTipoMovimientoBaja, p_IdUsuario, p_Observacion)
  RETURNING mb."FechaMovimiento" INTO v_FechaMovimiento;

  RETURN QUERY
  SELECT
    p_IdBobinaPapel,
    v_IdEstadoBaja,
    v_FechaMovimiento;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."DarDeBajaRodela"(p_idrodela integer, p_idusuario integer, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdRodela" integer, "CodigoRodela" text, "IdEstadoMateriaPrima" integer, "FechaMovimiento" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoActual  INTEGER;
  v_CodigoRodela    TEXT;
  v_FechaMovimiento TIMESTAMPTZ;
  c_IdEstadoAlmacen        CONSTANT INTEGER := 1;
  c_IdEstadoAbierta        CONSTANT INTEGER := 6;
  c_IdEstadoBaja           CONSTANT INTEGER := 4;
  c_IdTipoMovimientoBaja   CONSTANT INTEGER := 4;  -- fila de TipoMovimientoMateriaPrima con AplicaA que incluya 'Rodela'
BEGIN
  IF p_IdRodela IS NULL THEN
    RAISE EXCEPTION 'IdRodela es obligatorio para dar de baja.';
  END IF;

  IF p_Observacion IS NULL OR btrim(p_Observacion) = '' THEN
    RAISE EXCEPTION 'La observación (motivo de la baja) es obligatoria.';
  END IF;

  SELECT r."IdEstadoMateriaPrima", r."CodigoRodela"
  INTO v_IdEstadoActual, v_CodigoRodela
  FROM "Rodela" r
  WHERE r."IdRodela" = p_IdRodela
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la rodela con IdRodela = %', p_IdRodela;
  END IF;

  IF v_IdEstadoActual NOT IN (c_IdEstadoAlmacen, c_IdEstadoAbierta) THEN
    RAISE EXCEPTION 'La rodela % no está En almacén ni Abierta (estado actual: %), no puede darse de baja', p_IdRodela, v_IdEstadoActual;
  END IF;

  UPDATE "Rodela" AS r
  SET "IdEstadoMateriaPrima" = c_IdEstadoBaja
  WHERE r."IdRodela" = p_IdRodela;

  INSERT INTO "MovimientoRodela" AS mr ("IdRodela", "IdTipoMovimiento", "IdUsuario", "Observacion")
  VALUES (p_IdRodela, c_IdTipoMovimientoBaja, p_IdUsuario, p_Observacion)
  RETURNING mr."FechaMovimiento" INTO v_FechaMovimiento;

  RETURN QUERY
  SELECT p_IdRodela, v_CodigoRodela, c_IdEstadoBaja, v_FechaMovimiento;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."DarDeBajaSubBobina"(p_idsubbobina integer, p_idusuario integer, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdSubBobina" integer, "IdEstadoMateriaPrima" integer, "FechaMovimiento" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoActual          INTEGER;
  v_IdEstadoFueraInventario INTEGER := 5;
  v_IdEstadoBaja            INTEGER := 4;
  v_IdTipoMovimientoBaja    INTEGER := 4;
  v_FechaMovimiento         TIMESTAMPTZ;
BEGIN
  SELECT sb."IdEstadoMateriaPrima" INTO v_IdEstadoActual
  FROM "SubBobinaServilleta" AS sb
  WHERE sb."IdSubBobinaServilleta" = p_IdSubBobina
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la sub-bobina con IdSubBobinaServilleta = %', p_IdSubBobina;
  END IF;

  IF v_IdEstadoActual <> v_IdEstadoFueraInventario THEN
    RAISE EXCEPTION 'La sub-bobina % no está Fuera de Inventario (estado actual: %), no puede darse de baja', p_IdSubBobina, v_IdEstadoActual;
  END IF;

  UPDATE "SubBobinaServilleta" AS sb
  SET "IdEstadoMateriaPrima" = v_IdEstadoBaja
  WHERE sb."IdSubBobinaServilleta" = p_IdSubBobina;

  INSERT INTO "MovimientoSubBobina" AS msb ("IdSubBobinaServilleta", "IdTipoMovimiento", "IdUsuario", "Observacion")
  VALUES (p_IdSubBobina, v_IdTipoMovimientoBaja, p_IdUsuario, p_Observacion)
  RETURNING msb."FechaMovimiento" INTO v_FechaMovimiento;

  RETURN QUERY
  SELECT
    p_IdSubBobina,
    v_IdEstadoBaja,
    v_FechaMovimiento;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."DescontarEmpaqueBolsa"(p_idusuario integer, p_empaquesbolsa jsonb)
 RETURNS TABLE("IdTipoEmpaqueBolsa" integer, "NombreEmpaqueBolsa" text, "CantidadDescontada" numeric, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_item                JSONB;
  v_IdTipoEmpaqueBolsa  INTEGER;
  v_CantidadMovimiento  NUMERIC;
  v_Observacion         TEXT;
  v_CantidadDisponible  NUMERIC;
  v_CantidadActual      NUMERIC;
  c_IdTipoMovimientoTraslado CONSTANT INTEGER := 2; -- Traslado a producción
BEGIN
  IF p_EmpaquesBolsa IS NULL OR jsonb_array_length(p_EmpaquesBolsa) = 0 THEN
    RAISE EXCEPTION 'Debe proporcionar al menos un tipo de empaque bolsa a descontar.';
  END IF;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_EmpaquesBolsa)
  LOOP
    v_IdTipoEmpaqueBolsa := (v_item->>'IdTipoEmpaqueBolsa')::INTEGER;
    v_CantidadMovimiento := (v_item->>'CantidadMovimiento')::NUMERIC;
    v_Observacion := COALESCE(v_item->>'Observacion', 'Empaque bolsa trasladado a producción');

    IF v_CantidadMovimiento IS NULL OR v_CantidadMovimiento <= 0 THEN
      RAISE EXCEPTION 'La cantidad para el tipo de empaque bolsa % debe ser mayor a 0', v_IdTipoEmpaqueBolsa;
    END IF;

    SELECT ieb."CantidadActual" INTO v_CantidadDisponible
    FROM "InventarioEmpaqueBolsa" AS ieb
    WHERE ieb."IdTipoEmpaqueBolsa" = v_IdTipoEmpaqueBolsa
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe inventario registrado para IdTipoEmpaqueBolsa = %', v_IdTipoEmpaqueBolsa;
    END IF;

    IF v_CantidadDisponible < v_CantidadMovimiento THEN
      RAISE EXCEPTION 'Stock insuficiente para IdTipoEmpaqueBolsa = % (disponible: %, solicitado: %)', v_IdTipoEmpaqueBolsa, v_CantidadDisponible, v_CantidadMovimiento;
    END IF;

    UPDATE "InventarioEmpaqueBolsa" AS ieb
    SET "CantidadActual" = ieb."CantidadActual" - v_CantidadMovimiento
    WHERE ieb."IdTipoEmpaqueBolsa" = v_IdTipoEmpaqueBolsa
    RETURNING ieb."CantidadActual" INTO v_CantidadActual;

    INSERT INTO "MovimientoEmpaqueBolsa" AS meb (
      "IdTipoEmpaqueBolsa", "IdLoteEmpaque", "IdTipoMovimiento", "IdUsuario", "CantidadMovimiento", "Observacion"
    ) VALUES (
      v_IdTipoEmpaqueBolsa,
      NULL,
      c_IdTipoMovimientoTraslado,
      p_IdUsuario,
      v_CantidadMovimiento,
      v_Observacion
    );

    RETURN QUERY
    SELECT
      v_IdTipoEmpaqueBolsa,
      teb."NombreEmpaqueBolsa",
      v_CantidadMovimiento,
      v_CantidadActual
    FROM "TipoEmpaqueBolsa" AS teb
    WHERE teb."IdTipoEmpaqueBolsa" = v_IdTipoEmpaqueBolsa;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."DeshacerTrasladoRodela"(p_idrodela integer, p_idusuario integer, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdRodela" integer, "CodigoRodela" text, "IdEstadoMateriaPrima" integer, "FechaMovimiento" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
    c_ventana        constant interval := interval '30 minutes';
    c_mov_traslado   constant integer  := 2;   -- 'Traslado a producción'
    c_mov_devolucion constant integer  := 3;   -- 'Devolución a almacén'
    v_codigo         text;
    v_estado_actual  integer;
    v_id_almacen     integer;
    v_id_abierta     integer;
    v_fecha_traslado timestamptz;
    v_ahora          timestamptz := now();
BEGIN
    SELECT e."IdEstadoMateriaPrima" INTO v_id_almacen
    FROM "EstadoMateriaPrima" e WHERE e."TipoEstado" = 'En almacén';

    SELECT e."IdEstadoMateriaPrima" INTO v_id_abierta
    FROM "EstadoMateriaPrima" e WHERE e."TipoEstado" = 'Abierta';

    IF v_id_almacen IS NULL OR v_id_abierta IS NULL THEN
        RAISE EXCEPTION 'Catalogo EstadoMateriaPrima incompleto (falta En almacen o Abierta)';
    END IF;

    SELECT r."CodigoRodela", r."IdEstadoMateriaPrima"
    INTO v_codigo, v_estado_actual
    FROM "Rodela" r
    WHERE r."IdRodela" = p_IdRodela;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'No existe la rodela con id %', p_IdRodela;
    END IF;

    IF v_estado_actual <> v_id_abierta THEN
        RAISE EXCEPTION 'La rodela % no está Abierta, no puede deshacerse el traslado', v_codigo;
    END IF;

    SELECT max(mr."FechaMovimiento") INTO v_fecha_traslado
    FROM "MovimientoRodela" mr
    WHERE mr."IdRodela" = p_IdRodela
      AND mr."IdTipoMovimiento" = c_mov_traslado;

    IF v_fecha_traslado IS NULL THEN
        RAISE EXCEPTION 'La rodela % no tiene un traslado a producción registrado', v_codigo;
    END IF;

    IF v_ahora - v_fecha_traslado > c_ventana THEN
        RAISE EXCEPTION
          'La rodela % fue trasladada a producción hace más de 30 minutos; ya no puede reingresarse al almacén',
          v_codigo;
    END IF;

    UPDATE "Rodela" r
    SET "IdEstadoMateriaPrima" = v_id_almacen
    WHERE r."IdRodela" = p_IdRodela;

    INSERT INTO "MovimientoRodela"
        ("IdRodela", "IdTipoMovimiento", "IdUsuario", "FechaMovimiento", "Observacion")
    VALUES
        (p_IdRodela, c_mov_devolucion, p_IdUsuario, v_ahora, p_Observacion);

    RETURN QUERY
    SELECT p_IdRodela, v_codigo, v_id_almacen, v_ahora;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."EditarPerfil"(p_idusuario integer, p_primernombre text, p_apellidopaterno text, p_segundonombre text DEFAULT NULL::text, p_apellidomaterno text DEFAULT NULL::text, p_celular text DEFAULT NULL::text)
 RETURNS TABLE("IdUsuarioOut" integer, "CiOut" text, "PrimerNombreOut" text, "SegundoNombreOut" text, "ApellidoPaternoOut" text, "ApellidoMaternoOut" text, "NombreCompletoOut" text, "CelularOut" text, "IdRolOut" integer, "NombreRolOut" text, "IdEstadoUsuarioOut" integer, "NombreEstadoUsuarioOut" text, "FechaRegistroOut" timestamp with time zone)
 LANGUAGE sql
AS $function$
    WITH actualizado AS (
        UPDATE public."Usuario" AS u
           SET "PrimerNombre"    = NULLIF(btrim(p_PrimerNombre), ''),
               "ApellidoPaterno" = NULLIF(btrim(p_ApellidoPaterno), ''),
               "SegundoNombre"   = NULLIF(btrim(p_SegundoNombre), ''),
               "ApellidoMaterno" = NULLIF(btrim(p_ApellidoMaterno), ''),
               "Celular"         = NULLIF(btrim(p_Celular), '')
         WHERE u."IdUsuario" = p_IdUsuario
        RETURNING u.*
    )
    SELECT
        u."IdUsuario",
        u."Ci",
        u."PrimerNombre",
        u."SegundoNombre",
        u."ApellidoPaterno",
        u."ApellidoMaterno",
        concat_ws(
            ' ',
            u."PrimerNombre",
            u."SegundoNombre",
            u."ApellidoPaterno",
            u."ApellidoMaterno"
        ),
        u."Celular",
        u."IdRol",
        r."NombreRol",
        u."IdEstadoUsuario",
        e."NombreEstadoUsuario",
        u."FechaRegistro"
    FROM actualizado AS u
    INNER JOIN public."Rol" AS r
        ON r."IdRol" = u."IdRol"
    INNER JOIN public."EstadoUsuario" AS e
        ON e."IdEstadoUsuario" = u."IdEstadoUsuario";
$function$
;

CREATE OR REPLACE FUNCTION public."FinalizarProduccionBobinaTubo"(p_idproduccionbobinatubo integer, p_idusuario integer)
 RETURNS TABLE("IdProduccionBobinaTubo" integer, "FechaFinProduccion" timestamp with time zone, "IdEstadoProduccion" integer, "NombreEstadoProduccion" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoProduccionActual INTEGER;
  v_IdEstadoFinalizado       INTEGER := 3;
  v_IdEstadoAgotado          INTEGER := 3;
  v_IdTipoMovimientoFin      INTEGER := 7;
  v_IdBobina1                INTEGER;
  v_IdBobina2                INTEGER;
  v_FechaFinProduccion       TIMESTAMPTZ;
BEGIN
  SELECT pbt."IdEstadoProduccion", pbt."IdBobina_1", pbt."IdBobina_2"
  INTO v_IdEstadoProduccionActual, v_IdBobina1, v_IdBobina2
  FROM "ProduccionBobinaTubo" pbt
  WHERE pbt."IdProduccionBobinaTubo" = p_IdProduccionBobinaTubo
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la producción con IdProduccionBobinaTubo = %', p_IdProduccionBobinaTubo;
  END IF;

  IF v_IdEstadoProduccionActual <> 1 THEN
    RAISE EXCEPTION 'La producción % no se encuentra En Producción, no puede finalizarse', p_IdProduccionBobinaTubo;
  END IF;

  UPDATE "ProduccionBobinaTubo" AS pbt
  SET
    "IdEstadoProduccion" = v_IdEstadoFinalizado,
    "FechaFinProduccion" = now()
  WHERE pbt."IdProduccionBobinaTubo" = p_IdProduccionBobinaTubo
  RETURNING pbt."FechaFinProduccion" INTO v_FechaFinProduccion;

  UPDATE "BobinaPapel"
  SET "IdEstadoMateriaPrima" = v_IdEstadoAgotado
  WHERE "IdBobinaPapel" IN (v_IdBobina1, v_IdBobina2);

  INSERT INTO "MovimientoBobina" ("IdBobinaPapel", "IdTipoMovimiento", "IdUsuario", "Observacion")
  SELECT b."IdBobinaPapel", v_IdTipoMovimientoFin, p_IdUsuario, 'Producción terminada - Bobina Tubo #' || p_IdProduccionBobinaTubo
  FROM "BobinaPapel" b
  WHERE b."IdBobinaPapel" IN (v_IdBobina1, v_IdBobina2);

  RETURN QUERY
  SELECT
    p_IdProduccionBobinaTubo,
    v_FechaFinProduccion,
    v_IdEstadoFinalizado,
    ep."NombreEstadoProduccion"
  FROM "EstadoProduccion" ep
  WHERE ep."IdEstadoProduccion" = v_IdEstadoFinalizado;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."FinalizarProduccionServilleta"(p_idproduccionservilleta integer, p_idusuario integer)
 RETURNS TABLE("IdProduccionServilleta" integer, "FechaFinProduccion" timestamp with time zone, "IdEstadoProduccion" integer, "NombreEstadoProduccion" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoProduccionActual INTEGER;
  v_IdEstadoEnProduccion     INTEGER := 1;
  v_IdEstadoFinalizado       INTEGER := 3;
  v_IdEstadoAgotadoMP        INTEGER := 3;
  v_IdTipoMovimientoFin      INTEGER := 7;
  v_IdSubBobina              INTEGER;
  v_FechaFinProduccion       TIMESTAMPTZ;
BEGIN
  SELECT ps."IdEstadoProduccion", ps."IdSubBobina"
  INTO v_IdEstadoProduccionActual, v_IdSubBobina
  FROM "ProduccionServilleta" AS ps
  WHERE ps."IdProduccionServilleta" = p_IdProduccionServilleta
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la producción con IdProduccionServilleta = %', p_IdProduccionServilleta;
  END IF;

  IF v_IdEstadoProduccionActual <> v_IdEstadoEnProduccion THEN
    RAISE EXCEPTION 'La producción % no se encuentra En Producción, no puede finalizarse', p_IdProduccionServilleta;
  END IF;

  UPDATE "ProduccionServilleta" AS ps
  SET
    "IdEstadoProduccion" = v_IdEstadoFinalizado,
    "FechaFinProduccion" = now()
  WHERE ps."IdProduccionServilleta" = p_IdProduccionServilleta
  RETURNING ps."FechaFinProduccion" INTO v_FechaFinProduccion;

  UPDATE "SubBobinaServilleta" AS sb
  SET "IdEstadoMateriaPrima" = v_IdEstadoAgotadoMP
  WHERE sb."IdSubBobinaServilleta" = v_IdSubBobina;

  INSERT INTO "MovimientoSubBobina" ("IdSubBobinaServilleta", "IdTipoMovimiento", "IdUsuario", "Observacion")
  VALUES (v_IdSubBobina, v_IdTipoMovimientoFin, p_IdUsuario, 'Producción terminada - Producción Servilleta #' || p_IdProduccionServilleta);

  RETURN QUERY
  SELECT
    p_IdProduccionServilleta,
    v_FechaFinProduccion,
    v_IdEstadoFinalizado,
    ep."NombreEstadoProduccion"
  FROM "EstadoProduccion" AS ep
  WHERE ep."IdEstadoProduccion" = v_IdEstadoFinalizado;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."FnPausarProduccionBobinaTubo"(p_idproduccionbobinatubo integer, p_idusuario integer, p_motivopausaproduccion text)
 RETURNS TABLE("IdPausaProduccionBobinaTubo" integer, "IdProduccionBobinaTubo" integer, "FechaHoraPausa" timestamp with time zone, "MotivoPausaProduccion" text, "FechaHoraReanudacion" timestamp with time zone, "IdEstadoProduccion" integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoProduccionActual INTEGER;
  v_IdEstadoEnProduccion     INTEGER := 1;
  v_IdEstadoPausa            INTEGER := 2;
  v_IdPausaProduccionBobinaTubo INTEGER;
  v_FechaHoraPausa           TIMESTAMPTZ;
BEGIN
  SELECT pbt."IdEstadoProduccion"
  INTO v_IdEstadoProduccionActual
  FROM "ProduccionBobinaTubo" pbt
  WHERE pbt."IdProduccionBobinaTubo" = p_IdProduccionBobinaTubo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la producción con IdProduccionBobinaTubo = %', p_IdProduccionBobinaTubo;
  END IF;

  IF v_IdEstadoProduccionActual <> v_IdEstadoEnProduccion THEN
    RAISE EXCEPTION 'La producción % no se encuentra En Producción, no puede pausarse', p_IdProduccionBobinaTubo;
  END IF;

  INSERT INTO "PausaProduccionBobinaTubo" AS ppbt (
    "IdProduccionBobinaTubo",
    "IdUsuario",
    "FechaHoraPausa",
    "MotivoPausaProduccion",
    "FechaHoraReanudacion"
  ) VALUES (
    p_IdProduccionBobinaTubo,
    p_IdUsuario,
    now(),
    p_MotivoPausaProduccion,
    NULL
  )
  RETURNING ppbt."IdPausaProduccionBobinaTubo", ppbt."FechaHoraPausa"
  INTO v_IdPausaProduccionBobinaTubo, v_FechaHoraPausa;

  UPDATE "ProduccionBobinaTubo" AS pbt
  SET "IdEstadoProduccion" = v_IdEstadoPausa
  WHERE pbt."IdProduccionBobinaTubo" = p_IdProduccionBobinaTubo;

  RETURN QUERY
  SELECT
    v_IdPausaProduccionBobinaTubo,
    p_IdProduccionBobinaTubo,
    v_FechaHoraPausa,
    p_MotivoPausaProduccion,
    NULL::TIMESTAMPTZ,
    v_IdEstadoPausa;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."IngresarInsumoInventario"(p_idtipoinsumo integer, p_idusuario integer, p_cantidadmovimiento numeric, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdTipoInsumo" integer, "NombreInsumo" text, "CantidadIngresada" numeric, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_CantidadActual NUMERIC;
  v_Observacion TEXT;
  c_IdTipoMovimientoIngreso CONSTANT INTEGER := 1;
BEGIN
  IF p_CantidadMovimiento IS NULL OR p_CantidadMovimiento <= 0 THEN
    RAISE EXCEPTION 'La cantidad a ingresar debe ser mayor a 0.';
  END IF;

  v_Observacion := COALESCE(p_Observacion, 'Ingreso de insumo a inventario');

  PERFORM 1
  FROM "InventarioInsumo" AS ii
  WHERE ii."IdTipoInsumo" = p_IdTipoInsumo
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe inventario registrado para IdTipoInsumo = %', p_IdTipoInsumo;
  END IF;

  UPDATE "InventarioInsumo" AS ii
  SET "CantidadActual" = ii."CantidadActual" + p_CantidadMovimiento
  WHERE ii."IdTipoInsumo" = p_IdTipoInsumo
  RETURNING ii."CantidadActual" INTO v_CantidadActual;

  INSERT INTO "MovimientoInsumo" AS mi (
    "IdTipoInsumo", "IdTipoMovimiento", "IdUsuario", "CantidadMovimiento", "Observacion"
  ) VALUES (
    p_IdTipoInsumo,
    c_IdTipoMovimientoIngreso,
    p_IdUsuario,
    p_CantidadMovimiento,
    v_Observacion
  );

  RETURN QUERY
  SELECT
    ti."IdTipoInsumo",
    ti."NombreInsumo",
    p_CantidadMovimiento,
    v_CantidadActual
  FROM "TipoInsumo" AS ti
  WHERE ti."IdTipoInsumo" = p_IdTipoInsumo;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."IniciarProduccionBobinaTubo"(p_idbobina1 integer, p_idbobina2 integer, p_idusuario integer)
 RETURNS TABLE("IdProduccionBobinaTubo" integer, "FechaInicioProduccion" timestamp with time zone, "IdTurno" integer, "NombreTurno" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoProduccion    INTEGER := 1;
  v_IdEstadoAlmacen       INTEGER := 1;
  v_IdEstadoEnProdMP      INTEGER := 2;
  v_IdTipoMovimiento      INTEGER := 2;
  v_EstadoBobina1         INTEGER;
  v_EstadoBobina2         INTEGER;
  v_HoraLocal             TIME;
  v_IdTurno               INTEGER;
  v_IdProduccionBobinaTubo INTEGER;
  v_FechaInicioProduccion TIMESTAMPTZ;
BEGIN
  IF p_IdBobina1 IS NULL THEN
    RAISE EXCEPTION 'IdBobina1 es obligatorio para iniciar producción de Bobina Tubo.';
  END IF;

  IF p_IdBobina2 IS NULL THEN
    RAISE EXCEPTION 'IdBobina2 es obligatorio para iniciar producción de Bobina Tubo.';
  END IF;

  IF p_IdBobina1 = p_IdBobina2 THEN
    RAISE EXCEPTION 'IdBobina1 e IdBobina2 no pueden ser la misma bobina.';
  END IF;

  PERFORM set_config('app.current_usuario', p_IdUsuario::TEXT, true);

  SELECT "IdEstadoMateriaPrima" INTO v_EstadoBobina1
  FROM "BobinaPapel" WHERE "IdBobinaPapel" = p_IdBobina1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la bobina con IdBobinaPapel = %', p_IdBobina1;
  END IF;

  SELECT "IdEstadoMateriaPrima" INTO v_EstadoBobina2
  FROM "BobinaPapel" WHERE "IdBobinaPapel" = p_IdBobina2
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la bobina con IdBobinaPapel = %', p_IdBobina2;
  END IF;

  IF v_EstadoBobina1 <> v_IdEstadoAlmacen THEN
    RAISE EXCEPTION 'La bobina % no está En almacén (estado actual: %), no puede ingresar a producción', p_IdBobina1, v_EstadoBobina1;
  END IF;

  IF v_EstadoBobina2 <> v_IdEstadoAlmacen THEN
    RAISE EXCEPTION 'La bobina % no está En almacén (estado actual: %), no puede ingresar a producción', p_IdBobina2, v_EstadoBobina2;
  END IF;

  v_HoraLocal := (now() AT TIME ZONE 'America/La_Paz')::TIME;

  SELECT t."IdTurno" INTO v_IdTurno
  FROM "Turno" t
  WHERE
    (t."HoraInicio" <= t."HoraFin" AND v_HoraLocal BETWEEN t."HoraInicio" AND t."HoraFin")
    OR
    (t."HoraInicio" > t."HoraFin" AND (v_HoraLocal >= t."HoraInicio" OR v_HoraLocal <= t."HoraFin"))
  LIMIT 1;

  INSERT INTO "ProduccionBobinaTubo" AS pbt (
    "IdEstadoProduccion",
    "IdUsuario",
    "IdBobina_1",
    "IdBobina_2",
    "IdTurno",
    "FechaInicioProduccion",
    "FechaFinProduccion"
  ) VALUES (
    v_IdEstadoProduccion,
    p_IdUsuario,
    p_IdBobina1,
    p_IdBobina2,
    v_IdTurno,
    now(),
    NULL
  )
  RETURNING pbt."IdProduccionBobinaTubo", pbt."FechaInicioProduccion"
  INTO v_IdProduccionBobinaTubo, v_FechaInicioProduccion;

  UPDATE "BobinaPapel"
  SET "IdEstadoMateriaPrima" = v_IdEstadoEnProdMP
  WHERE "IdBobinaPapel" IN (p_IdBobina1, p_IdBobina2);

  INSERT INTO "MovimientoBobina" ("IdBobinaPapel", "IdTipoMovimiento", "IdUsuario", "Observacion")
  SELECT b."IdBobinaPapel", v_IdTipoMovimiento, p_IdUsuario, 'Traslado a producción - Producción Bobina Tubo'
  FROM "BobinaPapel" b
  WHERE b."IdBobinaPapel" IN (p_IdBobina1, p_IdBobina2);

  RETURN QUERY
  SELECT
    v_IdProduccionBobinaTubo,
    v_FechaInicioProduccion,
    v_IdTurno,
    t."NombreTurno"
  FROM "Turno" t
  WHERE t."IdTurno" = v_IdTurno;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."IniciarProduccionServilleta"(p_idsubbobina integer, p_idusuario integer)
 RETURNS TABLE("IdProduccionServilleta" integer, "FechaInicioProduccion" timestamp with time zone, "IdTurno" integer, "NombreTurno" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoProduccion    INTEGER := 1;
  v_IdEstadoAlmacenSub    INTEGER := 1;
  v_IdEstadoEnProdMP      INTEGER := 2;
  v_IdTipoMovimiento      INTEGER := 2;
  v_EstadoSubBobinaActual INTEGER;
  v_HoraLocal             TIME;
  v_IdTurno               INTEGER;
  v_IdProduccionServilleta INTEGER;
  v_FechaInicioProduccion TIMESTAMPTZ;
BEGIN
  IF p_IdSubBobina IS NULL THEN
    RAISE EXCEPTION 'IdSubBobina es obligatorio para iniciar producción de Servilleta.';
  END IF;

  SELECT sb."IdEstadoMateriaPrima"
  INTO v_EstadoSubBobinaActual
  FROM "SubBobinaServilleta" AS sb
  WHERE sb."IdSubBobinaServilleta" = p_IdSubBobina
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la sub-bobina con IdSubBobinaServilleta = %', p_IdSubBobina;
  END IF;

  IF v_EstadoSubBobinaActual <> v_IdEstadoAlmacenSub THEN
    RAISE EXCEPTION 'La sub-bobina % no está En almacén (estado actual: %), no puede ingresar a producción', p_IdSubBobina, v_EstadoSubBobinaActual;
  END IF;

  v_HoraLocal := (now() AT TIME ZONE 'America/La_Paz')::TIME;

  SELECT t."IdTurno" INTO v_IdTurno
  FROM "Turno" t
  WHERE
    (t."HoraInicio" <= t."HoraFin" AND v_HoraLocal BETWEEN t."HoraInicio" AND t."HoraFin")
    OR
    (t."HoraInicio" > t."HoraFin" AND (v_HoraLocal >= t."HoraInicio" OR v_HoraLocal <= t."HoraFin"))
  LIMIT 1;

  INSERT INTO "ProduccionServilleta" AS ps (
    "IdEstadoProduccion",
    "IdUsuario",
    "IdSubBobina",
    "IdTurno",
    "FechaInicioProduccion",
    "FechaFinProduccion"
  ) VALUES (
    v_IdEstadoProduccion,
    p_IdUsuario,
    p_IdSubBobina,
    v_IdTurno,
    now(),
    NULL
  )
  RETURNING ps."IdProduccionServilleta", ps."FechaInicioProduccion"
  INTO v_IdProduccionServilleta, v_FechaInicioProduccion;

  UPDATE "SubBobinaServilleta" AS sb
  SET "IdEstadoMateriaPrima" = v_IdEstadoEnProdMP
  WHERE sb."IdSubBobinaServilleta" = p_IdSubBobina;

  INSERT INTO "MovimientoSubBobina" ("IdSubBobinaServilleta", "IdTipoMovimiento", "IdUsuario", "Observacion")
  VALUES (p_IdSubBobina, v_IdTipoMovimiento, p_IdUsuario, 'Traslado a producción - Producción Servilleta');

  RETURN QUERY
  SELECT
    v_IdProduccionServilleta,
    v_FechaInicioProduccion,
    v_IdTurno,
    t."NombreTurno"
  FROM "Turno" t
  WHERE t."IdTurno" = v_IdTurno;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."InsertarBobinasPapel"(p_idproveedor integer, p_idtipobobina integer, p_idusuario integer, p_bobinas jsonb)
 RETURNS TABLE("FechaRecepcion" date, "CantidadBobinas" integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdLoteBobina     INTEGER;
  v_bobina           JSONB;
  v_CantidadBobinas  INTEGER := 0;
  v_FechaRecepcion   DATE;
  v_IdBobinaPapel    INTEGER;
  c_IdTipoMovimientoIngreso CONSTANT INTEGER := 1; 
BEGIN
  INSERT INTO "LoteBobina" AS lb ("IdProveedor", "IdUsuario", "FechaRecepcion")
  VALUES (p_IdProveedor, p_IdUsuario, CURRENT_DATE)
  RETURNING lb."IdLoteBobina", lb."FechaRecepcion" INTO v_IdLoteBobina, v_FechaRecepcion;

  FOR v_bobina IN SELECT * FROM jsonb_array_elements(p_Bobinas)
  LOOP
    INSERT INTO "BobinaPapel" (
      "CodigoBobina",
      "IdTipoBobina",
      "IdLoteBobina",
      "IdEstadoMateriaPrima",
      "PesoBrutoKg",
      "Gramaje",
      "PesoNetoKg"
    ) VALUES (
      v_bobina->>'CodigoBobina',
      p_IdTipoBobina,
      v_IdLoteBobina,
      1,
      (v_bobina->>'PesoBrutoKg')::NUMERIC,
      (v_bobina->>'Gramaje')::NUMERIC,
      (v_bobina->>'PesoNetoKg')::NUMERIC
    )
    RETURNING "IdBobinaPapel" INTO v_IdBobinaPapel;

    INSERT INTO "MovimientoBobina" (
      "IdBobinaPapel", "IdTipoMovimiento", "IdUsuario", "Observacion"
    ) VALUES (
      v_IdBobinaPapel,
      c_IdTipoMovimientoIngreso,
      p_IdUsuario,
      'Ingreso automático al almacén por registro de bobina'
    );

    v_CantidadBobinas := v_CantidadBobinas + 1;
  END LOOP;

  RETURN QUERY
  SELECT
    v_FechaRecepcion,
    v_CantidadBobinas;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."InsertarBobinasServilleta"(p_idproveedor integer, p_idtipobobinaservilleta integer, p_idusuario integer, p_bobinas jsonb)
 RETURNS TABLE("FechaRecepcion" date, "CantidadBobinasServilleta" integer, "CantidadUnidades" integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdLoteBobinaServilleta INTEGER;
  v_FechaRecepcion         DATE;
  v_bobina                 JSONB;
  v_unidad                 JSONB;
  v_IdBobinaServilleta     INTEGER;
  v_CantidadUnidadesBobina INTEGER;
  v_CantidadBobinas        INTEGER := 0;
  v_CantidadUnidadesTotal  INTEGER := 0;
  c_IdEstadoAlmacen        CONSTANT INTEGER := 1;
  c_IdTipoMovimientoIngreso CONSTANT INTEGER := 1;
BEGIN
  IF p_Bobinas IS NULL OR jsonb_array_length(p_Bobinas) = 0 THEN
    RAISE EXCEPTION 'Debe proporcionar al menos una BobinaServilleta.';
  END IF;

  INSERT INTO "LoteBobinaServilleta" AS lbs ("IdProveedor", "IdUsuario", "FechaRecepcion")
  VALUES (p_IdProveedor, p_IdUsuario, CURRENT_DATE)
  RETURNING lbs."IdLoteBobinaServilleta", lbs."FechaRecepcion" INTO v_IdLoteBobinaServilleta, v_FechaRecepcion;

  FOR v_bobina IN SELECT * FROM jsonb_array_elements(p_Bobinas)
  LOOP
    IF v_bobina->'Unidades' IS NULL OR jsonb_array_length(v_bobina->'Unidades') <> 2 THEN
      RAISE EXCEPTION 'Cada BobinaServilleta debe tener exactamente 2 unidades. Recibido: %', COALESCE(jsonb_array_length(v_bobina->'Unidades'), 0);
    END IF;

    INSERT INTO "BobinaServilleta" AS bs (
      "IdLoteBobinaServilleta",
      "IdTipoBobinaServilleta",
      "IdEstadoMateriaPrima"
    ) VALUES (
      v_IdLoteBobinaServilleta,
      p_IdTipoBobinaServilleta,
      c_IdEstadoAlmacen
    )
    RETURNING bs."IdBobinaServilleta" INTO v_IdBobinaServilleta;

    INSERT INTO "MovimientoBobinaServilleta" (
      "IdBobinaServilleta", "IdTipoMovimiento", "IdUsuario", "Observacion"
    ) VALUES (
      v_IdBobinaServilleta,
      c_IdTipoMovimientoIngreso,
      p_IdUsuario,
      'Ingreso a almacén - Lote #' || v_IdLoteBobinaServilleta
    );

    v_CantidadUnidadesBobina := 0;

    FOR v_unidad IN SELECT * FROM jsonb_array_elements(v_bobina->'Unidades')
    LOOP
      IF v_unidad->>'CodigoBobina' IS NULL OR btrim(v_unidad->>'CodigoBobina') = '' THEN
        RAISE EXCEPTION 'CodigoBobina es obligatorio para cada UnidadBobinaServilleta.';
      END IF;

      IF v_unidad->>'IdFormatoSubBobina' IS NULL THEN
        RAISE EXCEPTION 'IdFormatoSubBobina es obligatorio para la unidad con CodigoBobina = %', v_unidad->>'CodigoBobina';
      END IF;

      INSERT INTO "UnidadBobinaServilleta" (
        "IdBobinaServilleta",
        "IdFormatoSubBobina",
        "CodigoBobina",
        "PesoBrutoKg",
        "GramajeGr"
      ) VALUES (
        v_IdBobinaServilleta,
        (v_unidad->>'IdFormatoSubBobina')::INTEGER,
        v_unidad->>'CodigoBobina',
        (v_unidad->>'PesoBrutoKg')::NUMERIC,
        (v_unidad->>'GramajeGr')::NUMERIC
      );

      v_CantidadUnidadesBobina := v_CantidadUnidadesBobina + 1;
    END LOOP;

    v_CantidadBobinas := v_CantidadBobinas + 1;
    v_CantidadUnidadesTotal := v_CantidadUnidadesTotal + v_CantidadUnidadesBobina;
  END LOOP;

  RETURN QUERY
  SELECT
    v_FechaRecepcion,
    v_CantidadBobinas,
    v_CantidadUnidadesTotal;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."InsertarEmpaqueBolsa"(p_idproveedor integer, p_idusuario integer, p_cantidadtoneladaspedida numeric, p_empaquesbolsa jsonb)
 RETURNS TABLE("FechaRecepcion" date, "IdTipoEmpaqueBolsa" integer, "NombreEmpaqueBolsa" text, "CantidadIngresada" numeric, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdLoteEmpaque    INTEGER;
  v_FechaRecepcion   DATE;
  v_item             JSONB;
  v_IdTipoEmpaqueBolsa INTEGER;
  v_CantidadMovimiento NUMERIC;
  v_Observacion      TEXT;
  v_CantidadActual   NUMERIC;
  c_IdTipoMovimientoIngreso CONSTANT INTEGER := 1;
BEGIN
  INSERT INTO "LoteEmpaque" AS le ("IdProveedor", "IdUsuario", "FechaRecepcion", "CantidadToneladasPedida")
  VALUES (p_IdProveedor, p_IdUsuario, CURRENT_DATE, p_CantidadToneladasPedida)
  RETURNING le."IdLoteEmpaque", le."FechaRecepcion" INTO v_IdLoteEmpaque, v_FechaRecepcion;

  FOR v_item IN SELECT * FROM jsonb_array_elements(p_EmpaquesBolsa)
  LOOP
    v_IdTipoEmpaqueBolsa := (v_item->>'IdTipoEmpaqueBolsa')::INTEGER;
    v_CantidadMovimiento := (v_item->>'CantidadMovimiento')::NUMERIC;
    v_Observacion := COALESCE(v_item->>'Observacion', 'Ingreso automático al almacén por registro de empaque bolsa');

    IF v_CantidadMovimiento IS NULL OR v_CantidadMovimiento <= 0 THEN
      RAISE EXCEPTION 'La cantidad para el tipo de empaque bolsa % debe ser mayor a 0', v_IdTipoEmpaqueBolsa;
    END IF;

    PERFORM 1
    FROM "InventarioEmpaqueBolsa" AS ieb
    WHERE ieb."IdTipoEmpaqueBolsa" = v_IdTipoEmpaqueBolsa
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe inventario registrado para IdTipoEmpaqueBolsa = %', v_IdTipoEmpaqueBolsa;
    END IF;

    UPDATE "InventarioEmpaqueBolsa" AS ieb
    SET "CantidadActual" = ieb."CantidadActual" + v_CantidadMovimiento
    WHERE ieb."IdTipoEmpaqueBolsa" = v_IdTipoEmpaqueBolsa
    RETURNING ieb."CantidadActual" INTO v_CantidadActual;

    INSERT INTO "MovimientoEmpaqueBolsa" AS meb (
      "IdTipoEmpaqueBolsa", "IdLoteEmpaque", "IdTipoMovimiento", "IdUsuario", "CantidadMovimiento", "Observacion"
    ) VALUES (
      v_IdTipoEmpaqueBolsa,
      v_IdLoteEmpaque,
      c_IdTipoMovimientoIngreso,
      p_IdUsuario,
      v_CantidadMovimiento,
      v_Observacion
    );
  END LOOP;

  RETURN QUERY
  SELECT
    v_FechaRecepcion,
    teb."IdTipoEmpaqueBolsa",
    teb."NombreEmpaqueBolsa",
    SUM(meb."CantidadMovimiento") AS "CantidadIngresada",
    ieb."CantidadActual"
  FROM "MovimientoEmpaqueBolsa" AS meb
  INNER JOIN "TipoEmpaqueBolsa" AS teb
    ON teb."IdTipoEmpaqueBolsa" = meb."IdTipoEmpaqueBolsa"
  INNER JOIN "InventarioEmpaqueBolsa" AS ieb
    ON ieb."IdTipoEmpaqueBolsa" = meb."IdTipoEmpaqueBolsa"
  WHERE meb."IdLoteEmpaque" = v_IdLoteEmpaque
  GROUP BY teb."IdTipoEmpaqueBolsa", teb."NombreEmpaqueBolsa", ieb."CantidadActual";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."InsertarEmpaques"(p_idproveedor integer, p_idusuario integer, p_cantidadtoneladaspedida numeric, p_empaques jsonb)
 RETURNS TABLE("FechaRecepcion" date, "IdTipoEmpaque" integer, "NombreTipoEmpaque" text, "CantidadEmpaques" bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdLoteEmpaque    INTEGER;
  v_empaque          JSONB;
  v_FechaRecepcion   DATE;
  v_IdEmpaque        INTEGER;
  c_IdTipoMovimientoIngreso CONSTANT INTEGER := 1;
BEGIN
  INSERT INTO "LoteEmpaque" AS le ("IdProveedor", "FechaRecepcion", "CantidadToneladasPedida")
  VALUES (p_IdProveedor, CURRENT_DATE, p_CantidadToneladasPedida)
  RETURNING le."IdLoteEmpaque", le."FechaRecepcion" INTO v_IdLoteEmpaque, v_FechaRecepcion;

  FOR v_empaque IN SELECT * FROM jsonb_array_elements(p_Empaques)
  LOOP
    INSERT INTO "Empaque" (
      "CodigoEmpaque",
      "IdTipoEmpaque",
      "IdLoteEmpaque",
      "IdEstadoMateriaPrima",
      "PesoKg"
    ) VALUES (
      v_empaque->>'CodigoEmpaque',
      (v_empaque->>'IdTipoEmpaque')::INTEGER,
      v_IdLoteEmpaque,
      1,
      (v_empaque->>'PesoKg')::NUMERIC
    )
    RETURNING "IdEmpaque" INTO v_IdEmpaque;

    INSERT INTO "MovimientoEmpaque" AS me (
      "IdEmpaque", "IdTipoMovimiento", "IdUsuario", "Observacion"
    ) VALUES (
      v_IdEmpaque,
      c_IdTipoMovimientoIngreso,
      p_IdUsuario,
      'Ingreso automático al almacén por registro de empaque'
    );
  END LOOP;

  RETURN QUERY
  SELECT
    v_FechaRecepcion,
    te."IdTipoEmpaque",
    te."NombreTipoEmpaque",
    COUNT(emp."IdEmpaque") AS "CantidadEmpaques"
  FROM "Empaque" AS emp
  INNER JOIN "TipoEmpaque" AS te
    ON te."IdTipoEmpaque" = emp."IdTipoEmpaque"
  WHERE emp."IdLoteEmpaque" = v_IdLoteEmpaque
  GROUP BY te."IdTipoEmpaque", te."NombreTipoEmpaque";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."InsertarIngresoProductoTerminado"(p_idusuario integer, p_presentaciones jsonb)
 RETURNS TABLE("IdPresentacion" integer, "CodigoPresentacion" text, "NombreProducto" text, "CantidadIngresada" numeric, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_item JSONB;
  v_IdPresentacion INTEGER;
  v_Cantidad NUMERIC;
  v_Observacion TEXT;
  v_CantidadActual NUMERIC;
  c_IdTipoMovimientoEntrada CONSTANT INTEGER := 1;
  c_ObservacionPorDefecto CONSTANT TEXT := 'Ingreso al inventario de producto terminado';
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_Presentaciones)
  LOOP
    v_IdPresentacion := (v_item->>'IdPresentacion')::INTEGER;
    v_Cantidad := (v_item->>'Cantidad')::NUMERIC;
    v_Observacion := COALESCE(NULLIF(TRIM(v_item->>'Observacion'), ''), c_ObservacionPorDefecto);

    IF v_IdPresentacion IS NULL THEN
      RAISE EXCEPTION 'IdPresentacion es obligatorio en cada elemento del JSONB.';
    END IF;

    IF v_Cantidad IS NULL OR v_Cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad debe ser mayor a 0 para IdPresentacion = %', v_IdPresentacion;
    END IF;

    PERFORM 1 FROM "PresentacionProducto" AS pp WHERE pp."IdPresentacion" = v_IdPresentacion;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe la presentación con IdPresentacion = %', v_IdPresentacion;
    END IF;

    INSERT INTO "MovimientoProductoTerminado" (
      "IdTipoMovimientoInventario",
      "IdPresentacion",
      "IdUsuario",
      "CantidadIngresoInventario",
      "Observacion"
    ) VALUES (
      c_IdTipoMovimientoEntrada,
      v_IdPresentacion,
      p_IdUsuario,
      v_Cantidad,
      v_Observacion
    );

    UPDATE "InventarioProductoTerminado" AS ipt
    SET "CantidadActual" = ipt."CantidadActual" + v_Cantidad
    WHERE ipt."IdPresentacion" = v_IdPresentacion
    RETURNING ipt."CantidadActual" INTO v_CantidadActual;

    IF NOT FOUND THEN
      INSERT INTO "InventarioProductoTerminado" AS ipt2 ("IdPresentacion", "CantidadActual")
      VALUES (v_IdPresentacion, v_Cantidad)
      RETURNING ipt2."CantidadActual" INTO v_CantidadActual;
    END IF;

    RETURN QUERY
    SELECT
      pp."IdPresentacion",
      pp."CodigoPresentacion",
      p."NombreProducto",
      v_Cantidad,
      v_CantidadActual
    FROM "PresentacionProducto" AS pp
    INNER JOIN "Producto" AS p ON p."IdProducto" = pp."IdProducto"
    WHERE pp."IdPresentacion" = v_IdPresentacion;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."InsertarInventarioProductoTerminado"(p_idusuario integer, p_presentaciones jsonb, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdPresentacion" integer, "CodigoPresentacion" text, "CantidadIngresada" integer, "CantidadActual" integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_item                JSONB;
  v_IdPresentacion      INTEGER;
  v_Cantidad            INTEGER;
  v_CantidadActual      INTEGER;
  c_IdTipoMovimientoEntrada CONSTANT INTEGER := 1;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_Presentaciones)
  LOOP
    v_IdPresentacion := (v_item->>'IdPresentacion')::INTEGER;
    v_Cantidad       := (v_item->>'Cantidad')::INTEGER;

    IF v_Cantidad IS NULL OR v_Cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad inválida para IdPresentacion = %', v_IdPresentacion;
    END IF;

    PERFORM 1
    FROM "InventarioProductoTerminado" AS ipt
    WHERE ipt."IdPresentacion" = v_IdPresentacion
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe registro de inventario para IdPresentacion = %', v_IdPresentacion;
    END IF;

    UPDATE "InventarioProductoTerminado" AS ipt
    SET "CantidadActual" = ipt."CantidadActual" + v_Cantidad
    WHERE ipt."IdPresentacion" = v_IdPresentacion
    RETURNING ipt."CantidadActual" INTO v_CantidadActual;

    INSERT INTO "MovimientoInventarioProductoTerminado" (
      "IdPresentacion", "IdTipoMovimientoInventario", "IdUsuario", "Cantidad", "Observacion"
    ) VALUES (
      v_IdPresentacion, c_IdTipoMovimientoEntrada, p_IdUsuario, v_Cantidad, p_Observacion
    );

    RETURN QUERY
    SELECT
      v_IdPresentacion,
      pp."CodigoPresentacion",
      v_Cantidad,
      v_CantidadActual
    FROM "PresentacionProducto" AS pp
    WHERE pp."IdPresentacion" = v_IdPresentacion;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."InsertarMovimientoOperadorLogs"(p_idproduccionbobinatubo integer, p_idtipomovimientooperadorlogs integer, p_idusuario integer, p_cantidadlogs integer, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdMovimientoOperadorLogs" integer, "IdProduccionBobinaTubo" integer, "IdTipoMovimientoOperadorLogs" integer, "CantidadLogs" integer, "CantidadTotalActual" integer, "FechaMovimiento" timestamp without time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdTipoLogIngreso         CONSTANT INTEGER := 1;
  c_IdTipoLogDescuento       CONSTANT INTEGER := 2;
  c_IdTipoLogAumento         CONSTANT INTEGER := 3;
  c_IdEstadoEnProduccion     CONSTANT INTEGER := 1;
  c_IdEstadoPausa            CONSTANT INTEGER := 2;
  v_IdEstadoProduccionActual INTEGER;
  v_CantidadTotalActual      INTEGER;
  v_IdMovimientoOperadorLogs INTEGER;
  v_FechaMovimiento          TIMESTAMP;
BEGIN
  IF p_CantidadLogs IS NULL OR p_CantidadLogs <= 0 THEN
    RAISE EXCEPTION 'CantidadLogs debe ser un valor positivo.';
  END IF;

  SELECT pbt."IdEstadoProduccion", pbt."CantidadLogsActual"
  INTO v_IdEstadoProduccionActual, v_CantidadTotalActual
  FROM "ProduccionBobinaTubo" pbt
  WHERE pbt."IdProduccionBobinaTubo" = p_IdProduccionBobinaTubo
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la producción con IdProduccionBobinaTubo = %', p_IdProduccionBobinaTubo;
  END IF;

  IF v_IdEstadoProduccionActual NOT IN (c_IdEstadoEnProduccion, c_IdEstadoPausa) THEN
    RAISE EXCEPTION 'La producción % está en estado %, no se pueden registrar logs.', p_IdProduccionBobinaTubo, v_IdEstadoProduccionActual;
  END IF;

  IF p_IdTipoMovimientoOperadorLogs = c_IdTipoLogDescuento THEN
    IF v_CantidadTotalActual - p_CantidadLogs < 0 THEN
      RAISE EXCEPTION 'No se puede descontar % logs, el total actual es % para la producción %', p_CantidadLogs, v_CantidadTotalActual, p_IdProduccionBobinaTubo;
    END IF;
    v_CantidadTotalActual := v_CantidadTotalActual - p_CantidadLogs;
  ELSIF p_IdTipoMovimientoOperadorLogs IN (c_IdTipoLogIngreso, c_IdTipoLogAumento) THEN
    v_CantidadTotalActual := v_CantidadTotalActual + p_CantidadLogs;
  ELSE
    RAISE EXCEPTION 'IdTipoMovimientoOperadorLogs % no es válido.', p_IdTipoMovimientoOperadorLogs;
  END IF;

  UPDATE "ProduccionBobinaTubo" AS pbt
  SET "CantidadLogsActual" = v_CantidadTotalActual
  WHERE pbt."IdProduccionBobinaTubo" = p_IdProduccionBobinaTubo;

  INSERT INTO "MovimientoOperadorLogs" AS mol (
    "IdProduccionBobinaTubo",
    "IdTipoMovimientoOperadorLogs",
    "IdUsuario",
    "CantidadLogs",
    "Observacion"
  ) VALUES (
    p_IdProduccionBobinaTubo,
    p_IdTipoMovimientoOperadorLogs,
    p_IdUsuario,
    p_CantidadLogs,
    p_Observacion
  )
  RETURNING mol."IdMovimientoOperadorLogs", mol."FechaMovimiento"
  INTO v_IdMovimientoOperadorLogs, v_FechaMovimiento;

  RETURN QUERY
  SELECT
    v_IdMovimientoOperadorLogs,
    p_IdProduccionBobinaTubo,
    p_IdTipoMovimientoOperadorLogs,
    p_CantidadLogs,
    v_CantidadTotalActual,
    v_FechaMovimiento;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."InsertarRodelas"(p_idproveedor integer, p_idtiporodela integer, p_idusuario integer, p_rodelas jsonb)
 RETURNS TABLE("FechaRecepcion" date, "CantidadRodelas" integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdLoteRodela     INTEGER;
  v_rodela           JSONB;
  v_CantidadRodelas  INTEGER := 0;
  v_FechaRecepcion   DATE;
  v_IdRodela         INTEGER;
  c_IdEstadoAlmacen         CONSTANT INTEGER := 1;
  c_IdTipoMovimientoIngreso CONSTANT INTEGER := 1;
BEGIN
  IF p_Rodelas IS NULL
     OR jsonb_typeof(p_Rodelas) <> 'array'
     OR jsonb_array_length(p_Rodelas) = 0 THEN
    RAISE EXCEPTION 'Debe enviar al menos una rodela para registrar.';
  END IF;

  INSERT INTO "LoteRodela" AS lr ("IdProveedor", "IdUsuario", "FechaRecepcion")
  VALUES (p_IdProveedor, p_IdUsuario, CURRENT_DATE)
  RETURNING lr."IdLoteRodela", lr."FechaRecepcion" INTO v_IdLoteRodela, v_FechaRecepcion;

  FOR v_rodela IN SELECT * FROM jsonb_array_elements(p_Rodelas)
  LOOP
    INSERT INTO "Rodela" (
      "IdLoteRodela",
      "IdEstadoMateriaPrima",
      "IdTipoRodela",
      "CodigoRodela"
    ) VALUES (
      v_IdLoteRodela,
      c_IdEstadoAlmacen,
      p_IdTipoRodela,
      v_rodela->>'CodigoRodela'
    )
    RETURNING "IdRodela" INTO v_IdRodela;

    INSERT INTO "MovimientoRodela" (
      "IdRodela", "IdTipoMovimiento", "IdUsuario", "Observacion"
    ) VALUES (
      v_IdRodela,
      c_IdTipoMovimientoIngreso,
      p_IdUsuario,
      'Ingreso automático al almacén por registro de rodela'
    );

    v_CantidadRodelas := v_CantidadRodelas + 1;
  END LOOP;

  RETURN QUERY
  SELECT v_FechaRecepcion, v_CantidadRodelas;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."InsertarSalidaProductoTerminado"(p_idusuario integer, p_presentaciones jsonb)
 RETURNS TABLE("IdPresentacion" integer, "CodigoPresentacion" text, "NombreProducto" text, "CantidadSalida" numeric, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_item JSONB;
  v_IdPresentacion INTEGER;
  v_Cantidad NUMERIC;
  v_Observacion TEXT;
  v_CantidadDisponible NUMERIC;
  v_CantidadActual NUMERIC;
  c_IdTipoMovimientoSalida CONSTANT INTEGER := 2;
BEGIN
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_Presentaciones)
  LOOP
    v_IdPresentacion := (v_item->>'IdPresentacion')::INTEGER;
    v_Cantidad := (v_item->>'Cantidad')::NUMERIC;
    v_Observacion := v_item->>'Observacion';

    IF v_IdPresentacion IS NULL THEN
      RAISE EXCEPTION 'IdPresentacion es obligatorio en cada elemento del JSONB.';
    END IF;

    IF v_Cantidad IS NULL OR v_Cantidad <= 0 THEN
      RAISE EXCEPTION 'Cantidad debe ser mayor a 0 para IdPresentacion = %', v_IdPresentacion;
    END IF;

    SELECT ipt."CantidadActual" INTO v_CantidadDisponible
    FROM "InventarioProductoTerminado" AS ipt
    WHERE ipt."IdPresentacion" = v_IdPresentacion
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe inventario registrado para IdPresentacion = %', v_IdPresentacion;
    END IF;

    IF v_CantidadDisponible < v_Cantidad THEN
      RAISE EXCEPTION 'Stock insuficiente para IdPresentacion = % (disponible: %, solicitado: %)', v_IdPresentacion, v_CantidadDisponible, v_Cantidad;
    END IF;

    INSERT INTO "MovimientoProductoTerminado" (
      "IdTipoMovimientoInventario",
      "IdPresentacion",
      "IdUsuario",
      "CantidadIngresoInventario",
      "Observacion"
    ) VALUES (
      c_IdTipoMovimientoSalida,
      v_IdPresentacion,
      p_IdUsuario,
      v_Cantidad,
      v_Observacion
    );

    UPDATE "InventarioProductoTerminado" AS ipt
    SET "CantidadActual" = ipt."CantidadActual" - v_Cantidad
    WHERE ipt."IdPresentacion" = v_IdPresentacion
    RETURNING ipt."CantidadActual" INTO v_CantidadActual;

    RETURN QUERY
    SELECT
      pp."IdPresentacion",
      pp."CodigoPresentacion",
      p."NombreProducto",
      v_Cantidad,
      v_CantidadActual
    FROM "PresentacionProducto" AS pp
    INNER JOIN "Producto" AS p ON p."IdProducto" = pp."IdProducto"
    WHERE pp."IdPresentacion" = v_IdPresentacion;
  END LOOP;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."InsertarTipoInsumo"(p_nombreinsumo text, p_descripcioninsumo text)
 RETURNS TABLE("IdTipoInsumo" integer, "NombreInsumo" text, "DescripcionInsumo" text, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdTipoInsumo INTEGER;
BEGIN
  IF p_NombreInsumo IS NULL OR btrim(p_NombreInsumo) = '' THEN
    RAISE EXCEPTION 'El nombre del insumo es obligatorio.';
  END IF;

  INSERT INTO "TipoInsumo" AS ti ("NombreInsumo", "DescripcionInsumo")
  VALUES (p_NombreInsumo, p_DescripcionInsumo)
  RETURNING ti."IdTipoInsumo" INTO v_IdTipoInsumo;

  INSERT INTO "InventarioInsumo" AS ii ("IdTipoInsumo", "CantidadActual")
  VALUES (v_IdTipoInsumo, 0);

  RETURN QUERY
  SELECT
    ti."IdTipoInsumo",
    ti."NombreInsumo",
    ti."DescripcionInsumo",
    ii."CantidadActual"
  FROM "TipoInsumo" AS ti
  INNER JOIN "InventarioInsumo" AS ii
    ON ii."IdTipoInsumo" = ti."IdTipoInsumo"
  WHERE ti."IdTipoInsumo" = v_IdTipoInsumo;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."ListarBobinasPapelParaProduccion"(p_idtipobobina integer)
 RETURNS TABLE("IdBobinaPapel" integer, "CodigoBobina" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoAlmacen CONSTANT INTEGER := 1;
BEGIN
  RETURN QUERY
  SELECT
    bp."IdBobinaPapel",
    bp."CodigoBobina"
  FROM "BobinaPapel" AS bp
  WHERE bp."IdTipoBobina" = p_IdTipoBobina
    AND bp."IdEstadoMateriaPrima" = c_IdEstadoAlmacen
  ORDER BY bp."CodigoBobina";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."ListarRodelasEnAlmacen"(p_idtiporodela integer)
 RETURNS TABLE("IdRodela" integer, "CodigoRodela" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoAlmacen CONSTANT INTEGER := 1;
BEGIN
  RETURN QUERY
  SELECT r."IdRodela", r."CodigoRodela"
  FROM "Rodela" AS r
  WHERE r."IdTipoRodela" = p_IdTipoRodela
    AND r."IdEstadoMateriaPrima" = c_IdEstadoAlmacen
  ORDER BY r."CodigoRodela";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."ListarRodelasReingresables"()
 RETURNS TABLE("IdRodela" integer, "CodigoRodela" text, "IdTipoRodela" integer, "NombreTipoRodela" text, "FechaRecepcion" date, "NombreProveedor" text, "FechaTraslado" timestamp with time zone, "MinutosRestantes" integer)
 LANGUAGE sql
 STABLE
AS $function$
    WITH ultimo_traslado AS (
        SELECT mr."IdRodela", max(mr."FechaMovimiento") AS "FechaTraslado"
        FROM "MovimientoRodela" mr
        WHERE mr."IdTipoMovimiento" = 2           
        GROUP BY mr."IdRodela"
    )
    SELECT
        r."IdRodela",
        r."CodigoRodela",
        r."IdTipoRodela",
        tr."NombreTipoRodela",
        lr."FechaRecepcion",
        pr."NombreProveedor",
        ut."FechaTraslado",
        GREATEST(
            0,
            ceil(extract(epoch FROM (ut."FechaTraslado" + interval '30 minutes' - now())) / 60.0)
        )::integer                                AS "MinutosRestantes"
    FROM "Rodela" r
    JOIN ultimo_traslado ut     ON ut."IdRodela" = r."IdRodela"
    JOIN "EstadoMateriaPrima" e ON e."IdEstadoMateriaPrima" = r."IdEstadoMateriaPrima"
    JOIN "TipoRodela" tr        ON tr."IdTipoRodela" = r."IdTipoRodela"
    JOIN "LoteRodela" lr        ON lr."IdLoteRodela" = r."IdLoteRodela"
    JOIN "Proveedor" pr         ON pr."IdProveedor" = lr."IdProveedor"
    WHERE e."TipoEstado" = 'Abierta'
      AND now() - ut."FechaTraslado" <= interval '30 minutes'
    ORDER BY ut."FechaTraslado" ASC;
$function$
;

CREATE OR REPLACE FUNCTION public."MoverPalletTuboProduccionCancelada"(p_id_produccion_cancelada integer, p_id_pallet integer, p_estado_pallet integer, p_id_usuario integer, p_observacion text DEFAULT NULL::text)
 RETURNS void
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_estado_produccion INTEGER;
  v_pallet_prod INTEGER;
  v_tipo_mov INTEGER;
BEGIN
  SELECT "IdEstadoProduccion", "IdPallet"
  INTO v_estado_produccion, v_pallet_prod
  FROM "ProduccionPalletTubo"
  WHERE "IdProduccionPalletTubo" = p_id_produccion_cancelada
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la producción con ID %', p_id_produccion_cancelada;
  END IF;

  IF v_estado_produccion <> 4 THEN
    RAISE EXCEPTION 'La producción % no está Cancelada (estado actual: %)', p_id_produccion_cancelada, v_estado_produccion;
  END IF;

  IF p_id_pallet <> v_pallet_prod THEN
    RAISE EXCEPTION 'El pallet indicado no corresponde a la producción %', p_id_produccion_cancelada;
  END IF;

  IF p_estado_pallet NOT IN (1, 5) THEN
    RAISE EXCEPTION 'Estado destino inválido, solo se permite En almacén (1) o Fuera de Inventario (5)';
  END IF;

  v_tipo_mov := CASE p_estado_pallet WHEN 1 THEN 3 ELSE 5 END;

  UPDATE "Pallet" SET "IdEstadoMateriaPrima" = p_estado_pallet WHERE "IdPallet" = p_id_pallet;

  INSERT INTO "MovimientoPallet" ("IdPallet", "IdTipoMovimiento", "IdUsuario", "Observacion")
  VALUES (p_id_pallet, v_tipo_mov, p_id_usuario, p_observacion);
END;
$function$
;

CREATE OR REPLACE FUNCTION public."ObtenerPerfil"(p_idusuario integer)
 RETURNS TABLE("IdUsuarioOut" integer, "CiOut" text, "PrimerNombreOut" text, "SegundoNombreOut" text, "ApellidoPaternoOut" text, "ApellidoMaternoOut" text, "NombreCompletoOut" text, "CelularOut" text, "IdRolOut" integer, "NombreRolOut" text, "IdEstadoUsuarioOut" integer, "NombreEstadoUsuarioOut" text, "FechaRegistroOut" timestamp with time zone)
 LANGUAGE sql
 STABLE
AS $function$
    SELECT
        u."IdUsuario",
        u."Ci",
        u."PrimerNombre",
        u."SegundoNombre",
        u."ApellidoPaterno",
        u."ApellidoMaterno",
        concat_ws(
            ' ',
            u."PrimerNombre",
            u."SegundoNombre",
            u."ApellidoPaterno",
            u."ApellidoMaterno"
        ) AS "NombreCompleto",
        u."Celular",
        u."IdRol",
        r."NombreRol",
        u."IdEstadoUsuario",
        e."NombreEstadoUsuario",
        u."FechaRegistro"
    FROM public."Usuario" AS u
    INNER JOIN public."Rol" AS r
        ON r."IdRol" = u."IdRol"
    INNER JOIN public."EstadoUsuario" AS e
        ON e."IdEstadoUsuario" = u."IdEstadoUsuario"
    WHERE u."IdUsuario" = p_IdUsuario;
$function$
;

CREATE OR REPLACE FUNCTION public."ObtenerUsuarioPorId"(p_idusuario integer)
 RETURNS TABLE("IdUsuario" integer, "IdRol" integer, "NombreRol" text, "IdEstadoUsuario" integer, "NombreEstadoUsuario" text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        u."IdUsuario",
        u."IdRol",
        r."NombreRol",
        u."IdEstadoUsuario",
        eu."NombreEstadoUsuario"
    FROM "Usuario" u
    JOIN "Rol" r ON r."IdRol" = u."IdRol"
    JOIN "EstadoUsuario" eu ON eu."IdEstadoUsuario" = u."IdEstadoUsuario"
    WHERE u."IdUsuario" = p_IdUsuario;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."PausaProduccionServilleta"(p_idproduccionservilleta integer, p_idusuario integer, p_motivopausaproduccion text)
 RETURNS TABLE("IdPausaProduccionServilleta" integer, "IdProduccionServilleta" integer, "FechaHoraPausa" timestamp with time zone, "MotivoPausaProduccion" text, "FechaHoraReanudacion" timestamp with time zone, "IdEstadoProduccion" integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoProduccionActual  INTEGER;
  v_IdEstadoEnProduccion      INTEGER := 1;
  v_IdEstadoPausa             INTEGER := 2;
  v_IdPausaProduccionServilleta INTEGER;
  v_FechaHoraPausa            TIMESTAMPTZ;
BEGIN
  SELECT ps."IdEstadoProduccion"
  INTO v_IdEstadoProduccionActual
  FROM "ProduccionServilleta" AS ps
  WHERE ps."IdProduccionServilleta" = p_IdProduccionServilleta
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la producción con IdProduccionServilleta = %', p_IdProduccionServilleta;
  END IF;

  IF v_IdEstadoProduccionActual <> v_IdEstadoEnProduccion THEN
    RAISE EXCEPTION 'La producción % no se encuentra En Producción, no puede pausarse', p_IdProduccionServilleta;
  END IF;

  INSERT INTO "PausaProduccionServilleta" AS pps (
    "IdProduccionServilleta",
    "IdUsuario",
    "FechaHoraPausa",
    "MotivoPausaProduccion",
    "FechaHoraReanudacion"
  ) VALUES (
    p_IdProduccionServilleta,
    p_IdUsuario,
    now(),
    p_MotivoPausaProduccion,
    NULL
  )
  RETURNING pps."IdPausaProduccionServilleta", pps."FechaHoraPausa"
  INTO v_IdPausaProduccionServilleta, v_FechaHoraPausa;

  UPDATE "ProduccionServilleta" AS ps
  SET "IdEstadoProduccion" = v_IdEstadoPausa
  WHERE ps."IdProduccionServilleta" = p_IdProduccionServilleta;

  RETURN QUERY
  SELECT
    v_IdPausaProduccionServilleta,
    p_IdProduccionServilleta,
    v_FechaHoraPausa,
    p_MotivoPausaProduccion,
    NULL::TIMESTAMPTZ,
    v_IdEstadoPausa;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."ReanudarProduccionBobinaTubo"(p_idproduccionbobinatubo integer, p_idusuario integer)
 RETURNS TABLE("IdPausaProduccionBobinaTubo" integer, "IdProduccionBobinaTubo" integer, "FechaHoraPausa" timestamp with time zone, "MotivoPausaProduccion" text, "FechaHoraReanudacion" timestamp with time zone, "IdEstadoProduccion" integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoProduccionActual  INTEGER;
  v_IdEstadoEnProduccion      INTEGER := 1;
  v_IdEstadoPausa             INTEGER := 2;
  v_IdPausaProduccionBobinaTubo INTEGER;
  v_FechaHoraPausa            TIMESTAMPTZ;
  v_MotivoPausaProduccion     TEXT;
  v_FechaHoraReanudacion      TIMESTAMPTZ;
BEGIN
  SELECT pbt."IdEstadoProduccion"
  INTO v_IdEstadoProduccionActual
  FROM "ProduccionBobinaTubo" pbt
  WHERE pbt."IdProduccionBobinaTubo" = p_IdProduccionBobinaTubo;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la producción con IdProduccionBobinaTubo = %', p_IdProduccionBobinaTubo;
  END IF;

  IF v_IdEstadoProduccionActual <> v_IdEstadoPausa THEN
    RAISE EXCEPTION 'La producción % no se encuentra en Pausa, no puede reanudarse', p_IdProduccionBobinaTubo;
  END IF;

  SELECT ppbt."IdPausaProduccionBobinaTubo", ppbt."FechaHoraPausa", ppbt."MotivoPausaProduccion"
  INTO v_IdPausaProduccionBobinaTubo, v_FechaHoraPausa, v_MotivoPausaProduccion
  FROM "PausaProduccionBobinaTubo" ppbt
  WHERE ppbt."IdProduccionBobinaTubo" = p_IdProduccionBobinaTubo
    AND ppbt."FechaHoraReanudacion" IS NULL
  ORDER BY ppbt."FechaHoraPausa" DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe una pausa activa para la producción %', p_IdProduccionBobinaTubo;
  END IF;

  UPDATE "PausaProduccionBobinaTubo" AS ppbt
  SET "FechaHoraReanudacion" = now()
  WHERE ppbt."IdPausaProduccionBobinaTubo" = v_IdPausaProduccionBobinaTubo
  RETURNING ppbt."FechaHoraReanudacion" INTO v_FechaHoraReanudacion;

  UPDATE "ProduccionBobinaTubo" AS pbt
  SET "IdEstadoProduccion" = v_IdEstadoEnProduccion
  WHERE pbt."IdProduccionBobinaTubo" = p_IdProduccionBobinaTubo;

  RETURN QUERY
  SELECT
    v_IdPausaProduccionBobinaTubo,
    p_IdProduccionBobinaTubo,
    v_FechaHoraPausa,
    v_MotivoPausaProduccion,
    v_FechaHoraReanudacion,
    v_IdEstadoEnProduccion;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."ReanudarProduccionServilleta"(p_idproduccionservilleta integer, p_idusuario integer)
 RETURNS TABLE("IdPausaProduccionServilleta" integer, "IdProduccionServilleta" integer, "FechaHoraPausa" timestamp with time zone, "MotivoPausaProduccion" text, "FechaHoraReanudacion" timestamp with time zone, "IdEstadoProduccion" integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoProduccionActual    INTEGER;
  v_IdEstadoEnProduccion        INTEGER := 1;
  v_IdEstadoPausa               INTEGER := 2;
  v_IdPausaProduccionServilleta INTEGER;
  v_FechaHoraPausa              TIMESTAMPTZ;
  v_MotivoPausaProduccion       TEXT;
  v_FechaHoraReanudacion        TIMESTAMPTZ;
BEGIN
  SELECT ps."IdEstadoProduccion"
  INTO v_IdEstadoProduccionActual
  FROM "ProduccionServilleta" AS ps
  WHERE ps."IdProduccionServilleta" = p_IdProduccionServilleta
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la producción con IdProduccionServilleta = %', p_IdProduccionServilleta;
  END IF;

  IF v_IdEstadoProduccionActual <> v_IdEstadoPausa THEN
    RAISE EXCEPTION 'La producción % no se encuentra en Pausa, no puede reanudarse', p_IdProduccionServilleta;
  END IF;

  SELECT pps."IdPausaProduccionServilleta", pps."FechaHoraPausa", pps."MotivoPausaProduccion"
  INTO v_IdPausaProduccionServilleta, v_FechaHoraPausa, v_MotivoPausaProduccion
  FROM "PausaProduccionServilleta" AS pps
  WHERE pps."IdProduccionServilleta" = p_IdProduccionServilleta
    AND pps."FechaHoraReanudacion" IS NULL
  ORDER BY pps."FechaHoraPausa" DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe una pausa activa para la producción %', p_IdProduccionServilleta;
  END IF;

  UPDATE "PausaProduccionServilleta" AS pps
  SET "FechaHoraReanudacion" = now()
  WHERE pps."IdPausaProduccionServilleta" = v_IdPausaProduccionServilleta
  RETURNING pps."FechaHoraReanudacion" INTO v_FechaHoraReanudacion;

  UPDATE "ProduccionServilleta" AS ps
  SET "IdEstadoProduccion" = v_IdEstadoEnProduccion
  WHERE ps."IdProduccionServilleta" = p_IdProduccionServilleta;

  RETURN QUERY
  SELECT
    v_IdPausaProduccionServilleta,
    p_IdProduccionServilleta,
    v_FechaHoraPausa,
    v_MotivoPausaProduccion,
    v_FechaHoraReanudacion,
    v_IdEstadoEnProduccion;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."ReingresarBobinaAInventario"(p_idbobinapapel integer, p_idusuario integer, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdBobinaPapel" integer, "IdEstadoMateriaPrima" integer, "FechaMovimiento" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoActual            INTEGER;
  v_IdEstadoFueraInventario   INTEGER := 5;
  v_IdEstadoAlmacen           INTEGER := 1;
  v_IdTipoMovimientoReingreso INTEGER := 6;
  v_FechaMovimiento           TIMESTAMPTZ;
BEGIN
  SELECT bp."IdEstadoMateriaPrima" INTO v_IdEstadoActual
  FROM "BobinaPapel" bp
  WHERE bp."IdBobinaPapel" = p_IdBobinaPapel
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la bobina con IdBobinaPapel = %', p_IdBobinaPapel;
  END IF;

  IF v_IdEstadoActual <> v_IdEstadoFueraInventario THEN
    RAISE EXCEPTION 'La bobina % no está Fuera de Inventario (estado actual: %), no puede reingresarse', p_IdBobinaPapel, v_IdEstadoActual;
  END IF;

  UPDATE "BobinaPapel" AS bp
  SET "IdEstadoMateriaPrima" = v_IdEstadoAlmacen
  WHERE bp."IdBobinaPapel" = p_IdBobinaPapel;

  INSERT INTO "MovimientoBobina" AS mb ("IdBobinaPapel", "IdTipoMovimiento", "IdUsuario", "Observacion")
  VALUES (p_IdBobinaPapel, v_IdTipoMovimientoReingreso, p_IdUsuario, p_Observacion)
  RETURNING mb."FechaMovimiento" INTO v_FechaMovimiento;

  RETURN QUERY
  SELECT
    p_IdBobinaPapel,
    v_IdEstadoAlmacen,
    v_FechaMovimiento;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."ReingresarEmpaqueBolsaAInventario"(p_idusuario integer, p_idtipoempaquebolsa integer, p_cantidadmovimiento numeric, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdTipoEmpaqueBolsa" integer, "NombreEmpaqueBolsa" text, "CantidadReingresada" numeric, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_Observacion    TEXT;
  v_CantidadActual NUMERIC;
  c_IdTipoMovimientoReingreso CONSTANT INTEGER := 6; -- Reingreso a inventario
BEGIN
  IF p_CantidadMovimiento IS NULL OR p_CantidadMovimiento <= 0 THEN
    RAISE EXCEPTION 'La cantidad a reingresar debe ser mayor a 0';
  END IF;

  v_Observacion := COALESCE(p_Observacion, 'Reingreso de empaque bolsa a inventario');

  PERFORM 1
  FROM "InventarioEmpaqueBolsa" AS ieb
  WHERE ieb."IdTipoEmpaqueBolsa" = p_IdTipoEmpaqueBolsa
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe inventario registrado para IdTipoEmpaqueBolsa = %', p_IdTipoEmpaqueBolsa;
  END IF;

  UPDATE "InventarioEmpaqueBolsa" AS ieb
  SET "CantidadActual" = ieb."CantidadActual" + p_CantidadMovimiento
  WHERE ieb."IdTipoEmpaqueBolsa" = p_IdTipoEmpaqueBolsa
  RETURNING ieb."CantidadActual" INTO v_CantidadActual;

  INSERT INTO "MovimientoEmpaqueBolsa" AS meb (
    "IdTipoEmpaqueBolsa", "IdLoteEmpaque", "IdTipoMovimiento", "IdUsuario", "CantidadMovimiento", "Observacion"
  ) VALUES (
    p_IdTipoEmpaqueBolsa,
    NULL,
    c_IdTipoMovimientoReingreso,
    p_IdUsuario,
    p_CantidadMovimiento,
    v_Observacion
  );

  RETURN QUERY
  SELECT
    p_IdTipoEmpaqueBolsa,
    teb."NombreEmpaqueBolsa",
    p_CantidadMovimiento,
    v_CantidadActual
  FROM "TipoEmpaqueBolsa" AS teb
  WHERE teb."IdTipoEmpaqueBolsa" = p_IdTipoEmpaqueBolsa;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."ReingresarSubBobinaAInventario"(p_idsubbobina integer, p_idusuario integer, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdSubBobina" integer, "IdEstadoMateriaPrima" integer, "FechaMovimiento" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoActual            INTEGER;
  v_IdEstadoFueraInventario   INTEGER := 5;
  v_IdEstadoAlmacen           INTEGER := 1;
  v_IdTipoMovimientoReingreso INTEGER := 6;
  v_FechaMovimiento           TIMESTAMPTZ;
BEGIN
  SELECT sb."IdEstadoMateriaPrima" INTO v_IdEstadoActual
  FROM "SubBobinaServilleta" AS sb
  WHERE sb."IdSubBobinaServilleta" = p_IdSubBobina
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la sub-bobina con IdSubBobinaServilleta = %', p_IdSubBobina;
  END IF;

  IF v_IdEstadoActual <> v_IdEstadoFueraInventario THEN
    RAISE EXCEPTION 'La sub-bobina % no está Fuera de Inventario (estado actual: %), no puede reingresarse', p_IdSubBobina, v_IdEstadoActual;
  END IF;

  UPDATE "SubBobinaServilleta" AS sb
  SET "IdEstadoMateriaPrima" = v_IdEstadoAlmacen
  WHERE sb."IdSubBobinaServilleta" = p_IdSubBobina;

  INSERT INTO "MovimientoSubBobina" AS msb ("IdSubBobinaServilleta", "IdTipoMovimiento", "IdUsuario", "Observacion")
  VALUES (p_IdSubBobina, v_IdTipoMovimientoReingreso, p_IdUsuario, p_Observacion)
  RETURNING msb."FechaMovimiento" INTO v_FechaMovimiento;

  RETURN QUERY
  SELECT
    p_IdSubBobina,
    v_IdEstadoAlmacen,
    v_FechaMovimiento;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteCancelacionProduccionBobinaTubo"(p_idproduccion integer)
 RETURNS TABLE("FechaHoraCancelacion" timestamp with time zone, "MotivoCancelacion" text, "Ci" text, "Operador" text, "NombreRol" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    cpbt."FechaHoraCancelacion",
    cpbt."MotivoCancelacion",
    u."Ci",
    u."PrimerNombre" || ' ' || u."ApellidoPaterno" AS "Operador",
    r."NombreRol"
  FROM "CancelacionProduccionBobinaTubo" cpbt
  JOIN "Usuario" u ON u."IdUsuario" = cpbt."IdUsuario"
  JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE cpbt."IdProduccionBobinaTubo" = p_IdProduccion
  ORDER BY cpbt."FechaHoraCancelacion" DESC
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteCancelacionProduccionServilleta"(p_idproduccion integer)
 RETURNS TABLE("FechaHoraCancelacion" timestamp with time zone, "MotivoCancelacion" text, "Ci" text, "Operador" text, "NombreRol" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    cps."FechaHoraCancelacion",
    cps."MotivoCancelacion",
    u."Ci",
    u."PrimerNombre" || ' ' || u."ApellidoPaterno" AS "Operador",
    r."NombreRol"
  FROM "CancelacionProduccionServilleta" cps
  JOIN "Usuario" u ON u."IdUsuario" = cps."IdUsuario"
  JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE cps."IdProduccionServilleta" = p_IdProduccion
  ORDER BY cps."FechaHoraCancelacion" DESC
  LIMIT 1;
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteDetalleBobinaServilleta"(p_idbobinaservilleta integer)
 RETURNS TABLE("IdBobinaServilleta" integer, "NombreTipoBobinaServilleta" text, "TipoEstado" text, "CodigoLote" text, "FechaRecepcion" date, "NombreProveedor" text, "IdUnidadBobinaServilleta" integer, "CodigoUnidad" text, "DescripcionFormato" text, "PesoBrutoKg" numeric, "GramajeGr" numeric, "IdMovimientoSubBobina" integer, "IdSubBobinaServilleta" integer, "NombreTipoMedida" text, "NombreMovimiento" text, "FechaMovimiento" timestamp with time zone, "Observacion" text, "Ci" text, "PrimerNombre" text, "ApellidoPaterno" text, "NombreRol" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    bs."IdBobinaServilleta",
    tbs."NombreTipoBobinaServilleta",
    emp."TipoEstado",
    lbs."IdLoteBobinaServilleta"::text AS "CodigoLote",
    lbs."FechaRecepcion",
    p."NombreProveedor",
    ubs."IdUnidadBobinaServilleta",
    ubs."CodigoBobina" AS "CodigoUnidad",
    fsb."DescripcionFormato",
    ubs."PesoBrutoKg",
    ubs."GramajeGr",
    msb."IdMovimientoSubBobina",
    sbs."IdSubBobinaServilleta",
    tms."Descripcion" AS "NombreTipoMedida",
    tmmp."NombreMovimiento",
    msb."FechaMovimiento",
    msb."Observacion",
    u."Ci",
    u."PrimerNombre",
    u."ApellidoPaterno",
    r."NombreRol"
  FROM "BobinaServilleta" bs
  JOIN "TipoBobinaServilleta" tbs ON tbs."IdTipoBobinaServilleta" = bs."IdTipoBobinaServilleta"
  JOIN "EstadoMateriaPrima" emp ON emp."IdEstadoMateriaPrima" = bs."IdEstadoMateriaPrima"
  JOIN "LoteBobinaServilleta" lbs ON lbs."IdLoteBobinaServilleta" = bs."IdLoteBobinaServilleta"
  JOIN "Proveedor" p ON p."IdProveedor" = lbs."IdProveedor"
  JOIN "UnidadBobinaServilleta" ubs ON ubs."IdBobinaServilleta" = bs."IdBobinaServilleta"
  JOIN "FormatoSubBobina" fsb ON fsb."IdFormatoSubBobina" = ubs."IdFormatoSubBobina"
  LEFT JOIN "SubBobinaServilleta" sbs ON sbs."IdUnidadBobinaServilleta" = ubs."IdUnidadBobinaServilleta"
  LEFT JOIN "TipoMedidaSubBobina" tms ON tms."IdTipoMedidaSubBobina" = sbs."IdTipoMedidaSubBobina"
  LEFT JOIN "MovimientoSubBobina" msb ON msb."IdSubBobinaServilleta" = sbs."IdSubBobinaServilleta"
  LEFT JOIN "TipoMovimientoMateriaPrima" tmmp ON tmmp."IdTipoMovimiento" = msb."IdTipoMovimiento"
  LEFT JOIN "Usuario" u ON u."IdUsuario" = msb."IdUsuario"
  LEFT JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE bs."IdBobinaServilleta" = p_IdBobinaServilleta
  ORDER BY ubs."IdUnidadBobinaServilleta", msb."FechaMovimiento" ASC NULLS LAST;
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteHistorialMovimientosBobina"(p_idbobinapapel integer)
 RETURNS TABLE("IdMovimientoBobina" integer, "NombreMovimiento" text, "FechaMovimiento" timestamp with time zone, "Observacion" text, "Ci" text, "PrimerNombre" text, "ApellidoPaterno" text, "NombreRol" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    mb."IdMovimientoBobina",
    tmmp."NombreMovimiento",
    mb."FechaMovimiento",
    mb."Observacion",
    u."Ci",
    u."PrimerNombre",
    u."ApellidoPaterno",
    r."NombreRol"
  FROM "MovimientoBobina" mb
  JOIN "TipoMovimientoMateriaPrima" tmmp ON mb."IdTipoMovimiento" = tmmp."IdTipoMovimiento"
  JOIN "Usuario" u ON mb."IdUsuario" = u."IdUsuario"
  JOIN "Rol" r ON u."IdRol" = r."IdRol"
  WHERE mb."IdBobinaPapel" = p_IdBobinaPapel
  ORDER BY mb."FechaMovimiento" ASC;
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteHistorialMovimientosBobinaServilleta"(p_idbobinaservilleta integer)
 RETURNS TABLE("IdMovimientoBobinaServilleta" integer, "NombreMovimiento" text, "FechaMovimiento" timestamp with time zone, "Observacion" text, "Ci" text, "PrimerNombre" text, "ApellidoPaterno" text, "NombreRol" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    mbs."IdMovimientoBobinaServilleta",
    tmmp."NombreMovimiento",
    mbs."FechaMovimiento",
    mbs."Observacion",
    u."Ci",
    u."PrimerNombre",
    u."ApellidoPaterno",
    r."NombreRol"
  FROM "MovimientoBobinaServilleta" mbs
  JOIN "TipoMovimientoMateriaPrima" tmmp ON tmmp."IdTipoMovimiento" = mbs."IdTipoMovimiento"
  JOIN "Usuario" u ON u."IdUsuario" = mbs."IdUsuario"
  JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE mbs."IdBobinaServilleta" = p_IdBobinaServilleta
  ORDER BY mbs."FechaMovimiento" ASC;
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteHistorialMovimientosRodela"(p_idrodela integer)
 RETURNS TABLE("IdMovimientoRodela" integer, "NombreMovimiento" text, "FechaMovimiento" timestamp with time zone, "Observacion" text, "Ci" text, "PrimerNombre" text, "ApellidoPaterno" text, "NombreRol" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    mr."IdMovimientoRodela",
    tmmp."NombreMovimiento",
    mr."FechaMovimiento",
    mr."Observacion",
    u."Ci",
    u."PrimerNombre",
    u."ApellidoPaterno",
    r."NombreRol"
  FROM "MovimientoRodela" mr
  JOIN "TipoMovimientoMateriaPrima" tmmp ON mr."IdTipoMovimiento" = tmmp."IdTipoMovimiento"
  JOIN "Usuario" u ON mr."IdUsuario" = u."IdUsuario"
  JOIN "Rol" r ON u."IdRol" = r."IdRol"
  WHERE mr."IdRodela" = p_IdRodela
  ORDER BY mr."FechaMovimiento" ASC;
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteHistorialMovimientosUnidadServilleta"(p_idunidadbobinaservilleta integer)
 RETURNS TABLE("IdUnidadBobinaServilleta" integer, "CodigoBobina" text, "DescripcionFormato" text, "PesoBrutoKg" numeric, "GramajeGr" numeric, "IdBobinaServilleta" integer, "NombreTipoBobinaServilleta" text, "TipoEstado" text, "IdMovimientoSubBobina" integer, "IdSubBobinaServilleta" integer, "NombreTipoMedida" text, "NombreMovimiento" text, "FechaMovimiento" timestamp with time zone, "Observacion" text, "Ci" text, "PrimerNombre" text, "ApellidoPaterno" text, "NombreRol" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    ubs."IdUnidadBobinaServilleta",
    ubs."CodigoBobina",
    fsb."DescripcionFormato",
    ubs."PesoBrutoKg",
    ubs."GramajeGr",
    bs."IdBobinaServilleta",
    tbs."NombreTipoBobinaServilleta",
    embs."TipoEstado",
    msb."IdMovimientoSubBobina",
    sbs."IdSubBobinaServilleta",
    tms."Descripcion" AS "NombreTipoMedida",
    tmmp."NombreMovimiento",
    msb."FechaMovimiento",
    msb."Observacion",
    u."Ci",
    u."PrimerNombre",
    u."ApellidoPaterno",
    r."NombreRol"
  FROM "UnidadBobinaServilleta" ubs
  JOIN "BobinaServilleta" bs ON bs."IdBobinaServilleta" = ubs."IdBobinaServilleta"
  JOIN "TipoBobinaServilleta" tbs ON tbs."IdTipoBobinaServilleta" = bs."IdTipoBobinaServilleta"
  JOIN "EstadoMateriaPrima" embs ON embs."IdEstadoMateriaPrima" = bs."IdEstadoMateriaPrima"
  JOIN "FormatoSubBobina" fsb ON fsb."IdFormatoSubBobina" = ubs."IdFormatoSubBobina"
  LEFT JOIN "SubBobinaServilleta" sbs ON sbs."IdUnidadBobinaServilleta" = ubs."IdUnidadBobinaServilleta"
  LEFT JOIN "TipoMedidaSubBobina" tms ON tms."IdTipoMedidaSubBobina" = sbs."IdTipoMedidaSubBobina"
  LEFT JOIN "MovimientoSubBobina" msb ON msb."IdSubBobinaServilleta" = sbs."IdSubBobinaServilleta"
  LEFT JOIN "TipoMovimientoMateriaPrima" tmmp ON tmmp."IdTipoMovimiento" = msb."IdTipoMovimiento"
  LEFT JOIN "Usuario" u ON u."IdUsuario" = msb."IdUsuario"
  LEFT JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE ubs."IdUnidadBobinaServilleta" = p_IdUnidadBobinaServilleta
  ORDER BY msb."FechaMovimiento" ASC NULLS LAST;
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteInventarioBobinaPapel"("p_IdsTipoBobina" integer[] DEFAULT NULL::integer[])
 RETURNS TABLE("FechaGeneracion" timestamp with time zone, "TotalBobinasInforme" bigint, "PesoNetoGeneralKg" numeric, "IdTipoBobina" integer, "NombreTipoBobina" text, "CantidadBobinasTipo" bigint, "PesoNetoTotalTipoKg" numeric, "GramajePromedioTipo" numeric, "RecepcionMasAntiguaTipo" date, "RecepcionMasRecienteTipo" date, "IdBobinaPapel" integer, "CodigoBobina" text, "CodigoLote" text, "FechaRecepcion" date, "NombreProveedor" text, "PesoBrutoKg" numeric, "PesoNetoKg" numeric, "Gramaje" numeric)
 LANGUAGE sql
 STABLE
AS $function$
    SELECT
        now()                                                                          AS "FechaGeneracion",
        COUNT(*) OVER ()                                                                AS "TotalBobinasInforme",
        COALESCE(SUM(b."PesoNetoKg") OVER (), 0)                                        AS "PesoNetoGeneralKg",

        t."IdTipoBobina",
        t."NombreTipoBobina",
        COUNT(*) OVER (PARTITION BY b."IdTipoBobina")                                   AS "CantidadBobinasTipo",
        COALESCE(SUM(b."PesoNetoKg") OVER (PARTITION BY b."IdTipoBobina"), 0)           AS "PesoNetoTotalTipoKg",
        COALESCE(ROUND(AVG(b."Gramaje") OVER (PARTITION BY b."IdTipoBobina"), 2), 0)    AS "GramajePromedioTipo",
        MIN(l."FechaRecepcion") OVER (PARTITION BY b."IdTipoBobina")                    AS "RecepcionMasAntiguaTipo",
        MAX(l."FechaRecepcion") OVER (PARTITION BY b."IdTipoBobina")                    AS "RecepcionMasRecienteTipo",

        b."IdBobinaPapel",
        b."CodigoBobina",
        l."IdLoteBobina"::text   AS "CodigoLote",   
        l."FechaRecepcion",
        p."NombreProveedor",
        b."PesoBrutoKg",
        b."PesoNetoKg",
        b."Gramaje"
    FROM "BobinaPapel" b
    JOIN "TipoBobina" t ON t."IdTipoBobina" = b."IdTipoBobina"
    JOIN "LoteBobina" l ON l."IdLoteBobina" = b."IdLoteBobina"
    JOIN "Proveedor"  p ON p."IdProveedor"  = l."IdProveedor"
    WHERE b."IdEstadoMateriaPrima" = 1
      AND ("p_IdsTipoBobina" IS NULL OR b."IdTipoBobina" = ANY("p_IdsTipoBobina"))
    ORDER BY t."NombreTipoBobina", l."FechaRecepcion", b."CodigoBobina";
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteInventarioBobinaServilleta"("p_IdsTipoBobinaServilleta" integer[] DEFAULT NULL::integer[])
 RETURNS TABLE("FechaGeneracion" timestamp with time zone, "TotalBobinasInforme" bigint, "PesoBrutoGeneralKg" numeric, "IdTipoBobinaServilleta" integer, "NombreTipoBobinaServilleta" text, "CantidadBobinasTipo" bigint, "PesoBrutoTotalTipoKg" numeric, "GramajePromedioTipo" numeric, "RecepcionMasAntiguaTipo" date, "RecepcionMasRecienteTipo" date, "IdBobinaServilleta" integer, "CodigoLote" text, "FechaRecepcion" date, "NombreProveedor" text, "CodigoUnidad1" text, "DescripcionFormato1" text, "PesoBrutoKg1" numeric, "GramajeGr1" numeric, "CodigoUnidad2" text, "DescripcionFormato2" text, "PesoBrutoKg2" numeric, "GramajeGr2" numeric)
 LANGUAGE sql
 STABLE
AS $function$
    WITH base AS (
        SELECT
            bs."IdBobinaServilleta",
            bs."IdTipoBobinaServilleta",
            tbs."NombreTipoBobinaServilleta",
            lbs."IdLoteBobinaServilleta"::text AS "CodigoLote",
            lbs."FechaRecepcion",
            p."NombreProveedor",
            u1."CodigoBobina"          AS "CodigoUnidad1",
            fsb1."DescripcionFormato"  AS "DescripcionFormato1",
            u1."PesoBrutoKg"           AS "PesoBrutoKg1",
            u1."GramajeGr"             AS "GramajeGr1",
            u2."CodigoBobina"          AS "CodigoUnidad2",
            fsb2."DescripcionFormato"  AS "DescripcionFormato2",
            u2."PesoBrutoKg"           AS "PesoBrutoKg2",
            u2."GramajeGr"             AS "GramajeGr2",
            COALESCE(u1."PesoBrutoKg", 0) + COALESCE(u2."PesoBrutoKg", 0) AS "PesoBrutoBobinaKg",
            (COALESCE(u1."GramajeGr", 0) + COALESCE(u2."GramajeGr", 0))
                / NULLIF(
                    (CASE WHEN u1."GramajeGr" IS NOT NULL THEN 1 ELSE 0 END
                     + CASE WHEN u2."GramajeGr" IS NOT NULL THEN 1 ELSE 0 END), 0
                ) AS "GramajePromedioBobina"
        FROM "BobinaServilleta" bs
        JOIN "TipoBobinaServilleta" tbs ON tbs."IdTipoBobinaServilleta" = bs."IdTipoBobinaServilleta"
        JOIN "LoteBobinaServilleta" lbs ON lbs."IdLoteBobinaServilleta" = bs."IdLoteBobinaServilleta"
        JOIN "Proveedor" p ON p."IdProveedor" = lbs."IdProveedor"
        LEFT JOIN LATERAL (
            SELECT ub."CodigoBobina", ub."IdFormatoSubBobina", ub."PesoBrutoKg", ub."GramajeGr"
            FROM "UnidadBobinaServilleta" ub
            WHERE ub."IdBobinaServilleta" = bs."IdBobinaServilleta"
            ORDER BY ub."IdUnidadBobinaServilleta"
            LIMIT 1
        ) u1 ON true
        LEFT JOIN "FormatoSubBobina" fsb1 ON fsb1."IdFormatoSubBobina" = u1."IdFormatoSubBobina"
        LEFT JOIN LATERAL (
            SELECT ub."CodigoBobina", ub."IdFormatoSubBobina", ub."PesoBrutoKg", ub."GramajeGr"
            FROM "UnidadBobinaServilleta" ub
            WHERE ub."IdBobinaServilleta" = bs."IdBobinaServilleta"
            ORDER BY ub."IdUnidadBobinaServilleta"
            OFFSET 1 LIMIT 1
        ) u2 ON true
        LEFT JOIN "FormatoSubBobina" fsb2 ON fsb2."IdFormatoSubBobina" = u2."IdFormatoSubBobina"
        WHERE bs."IdEstadoMateriaPrima" = 1
          AND ("p_IdsTipoBobinaServilleta" IS NULL OR bs."IdTipoBobinaServilleta" = ANY("p_IdsTipoBobinaServilleta"))
    )
    SELECT
        now()                                                              AS "FechaGeneracion",
        COUNT(*) OVER ()                                                   AS "TotalBobinasInforme",
        COALESCE(SUM("PesoBrutoBobinaKg") OVER (), 0)                      AS "PesoBrutoGeneralKg",

        "IdTipoBobinaServilleta",
        "NombreTipoBobinaServilleta",
        COUNT(*) OVER (PARTITION BY "IdTipoBobinaServilleta")              AS "CantidadBobinasTipo",
        COALESCE(SUM("PesoBrutoBobinaKg") OVER (PARTITION BY "IdTipoBobinaServilleta"), 0) AS "PesoBrutoTotalTipoKg",
        COALESCE(ROUND(AVG("GramajePromedioBobina") OVER (PARTITION BY "IdTipoBobinaServilleta"), 2), 0) AS "GramajePromedioTipo",
        MIN("FechaRecepcion") OVER (PARTITION BY "IdTipoBobinaServilleta")  AS "RecepcionMasAntiguaTipo",
        MAX("FechaRecepcion") OVER (PARTITION BY "IdTipoBobinaServilleta")  AS "RecepcionMasRecienteTipo",

        "IdBobinaServilleta",
        "CodigoLote",
        "FechaRecepcion",
        "NombreProveedor",
        "CodigoUnidad1",
        "DescripcionFormato1",
        "PesoBrutoKg1",
        "GramajeGr1",
        "CodigoUnidad2",
        "DescripcionFormato2",
        "PesoBrutoKg2",
        "GramajeGr2"
    FROM base
    ORDER BY "NombreTipoBobinaServilleta", "FechaRecepcion", "IdBobinaServilleta";
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteInventarioRodela"("p_IdsTipoRodela" integer[] DEFAULT NULL::integer[])
 RETURNS TABLE("FechaGeneracion" timestamp with time zone, "TotalRodelasInforme" bigint, "IdTipoRodela" integer, "NombreTipoRodela" text, "CantidadRodelasTipo" bigint, "RecepcionMasAntiguaTipo" date, "RecepcionMasRecienteTipo" date, "IdRodela" integer, "CodigoRodela" text, "IdLoteRodela" integer, "FechaRecepcion" date, "NombreProveedor" text)
 LANGUAGE sql
 STABLE
AS $function$
    SELECT
        now()                                                              AS "FechaGeneracion",
        COUNT(*) OVER ()                                                   AS "TotalRodelasInforme",

        t."IdTipoRodela",
        t."NombreTipoRodela",
        COUNT(*) OVER (PARTITION BY r."IdTipoRodela")                      AS "CantidadRodelasTipo",
        MIN(l."FechaRecepcion") OVER (PARTITION BY r."IdTipoRodela")       AS "RecepcionMasAntiguaTipo",
        MAX(l."FechaRecepcion") OVER (PARTITION BY r."IdTipoRodela")       AS "RecepcionMasRecienteTipo",

        r."IdRodela",
        r."CodigoRodela",
        l."IdLoteRodela",
        l."FechaRecepcion",
        p."NombreProveedor"
    FROM "Rodela" r
    JOIN "TipoRodela" t ON t."IdTipoRodela" = r."IdTipoRodela"
    JOIN "LoteRodela" l ON l."IdLoteRodela" = r."IdLoteRodela"
    JOIN "Proveedor"  p ON p."IdProveedor"  = l."IdProveedor"
    WHERE r."IdEstadoMateriaPrima" = 1
      AND ("p_IdsTipoRodela" IS NULL OR r."IdTipoRodela" = ANY("p_IdsTipoRodela"))
    ORDER BY t."NombreTipoRodela", l."FechaRecepcion", r."CodigoRodela";
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteLoteBobinaPapelDetalle"(p_idlotebobina integer)
 RETURNS TABLE("CodigoBobina" text, "NombreTipoBobina" text, "PesoBrutoKg" numeric, "Gramaje" numeric, "PesoNetoKg" numeric, "FechaRecepcion" date, "NombreProveedor" text, "CantidadBobinas" bigint, "Ci" text, "PrimerNombre" text, "ApellidoPaterno" text, "NombreRol" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    bp."CodigoBobina",
    tb."NombreTipoBobina",
    bp."PesoBrutoKg",
    bp."Gramaje",
    bp."PesoNetoKg",
    lb."FechaRecepcion",
    p."NombreProveedor",
    COUNT(*) OVER () AS "CantidadBobinas",
    u."Ci",
    u."PrimerNombre",
    u."ApellidoPaterno",
    r."NombreRol"
  FROM "BobinaPapel" bp
  JOIN "LoteBobina" lb ON bp."IdLoteBobina" = lb."IdLoteBobina"
  JOIN "Proveedor" p ON p."IdProveedor" = lb."IdProveedor"
  JOIN "TipoBobina" tb ON bp."IdTipoBobina" = tb."IdTipoBobina"
  INNER JOIN "Usuario" u ON u."IdUsuario" = lb."IdUsuario"
  INNER JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE bp."IdLoteBobina" = p_IdLoteBobina
  ORDER BY tb."NombreTipoBobina", bp."CodigoBobina";
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteLoteBobinaServilletaDetalle"(p_idlotebobinaservilleta integer)
 RETURNS TABLE("IdBobinaServilleta" integer, "NombreTipoBobinaServilleta" text, "CodigoUnidad1" text, "DescripcionFormato1" text, "PesoBrutoKg1" numeric, "GramajeGr1" numeric, "CodigoUnidad2" text, "DescripcionFormato2" text, "PesoBrutoKg2" numeric, "GramajeGr2" numeric, "FechaRecepcion" date, "NombreProveedor" text, "CantidadBobinas" bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    bs."IdBobinaServilleta",
    tbs."NombreTipoBobinaServilleta",
    u1."CodigoBobina"          AS "CodigoUnidad1",
    fsb1."DescripcionFormato"  AS "DescripcionFormato1",
    u1."PesoBrutoKg"           AS "PesoBrutoKg1",
    u1."GramajeGr"             AS "GramajeGr1",
    u2."CodigoBobina"          AS "CodigoUnidad2",
    fsb2."DescripcionFormato"  AS "DescripcionFormato2",
    u2."PesoBrutoKg"           AS "PesoBrutoKg2",
    u2."GramajeGr"             AS "GramajeGr2",
    lbs."FechaRecepcion",
    p."NombreProveedor",
    COUNT(*) OVER ()           AS "CantidadBobinas"
  FROM "BobinaServilleta" bs
  JOIN "TipoBobinaServilleta" tbs ON tbs."IdTipoBobinaServilleta" = bs."IdTipoBobinaServilleta"
  JOIN "LoteBobinaServilleta" lbs ON lbs."IdLoteBobinaServilleta" = bs."IdLoteBobinaServilleta"
  JOIN "Proveedor" p ON p."IdProveedor" = lbs."IdProveedor"
  LEFT JOIN LATERAL (
    SELECT ub."CodigoBobina", ub."IdFormatoSubBobina", ub."PesoBrutoKg", ub."GramajeGr"
    FROM "UnidadBobinaServilleta" ub
    WHERE ub."IdBobinaServilleta" = bs."IdBobinaServilleta"
    ORDER BY ub."IdUnidadBobinaServilleta"
    LIMIT 1
  ) u1 ON true
  LEFT JOIN "FormatoSubBobina" fsb1 ON fsb1."IdFormatoSubBobina" = u1."IdFormatoSubBobina"
  LEFT JOIN LATERAL (
    SELECT ub."CodigoBobina", ub."IdFormatoSubBobina", ub."PesoBrutoKg", ub."GramajeGr"
    FROM "UnidadBobinaServilleta" ub
    WHERE ub."IdBobinaServilleta" = bs."IdBobinaServilleta"
    ORDER BY ub."IdUnidadBobinaServilleta"
    OFFSET 1 LIMIT 1
  ) u2 ON true
  LEFT JOIN "FormatoSubBobina" fsb2 ON fsb2."IdFormatoSubBobina" = u2."IdFormatoSubBobina"
  WHERE bs."IdLoteBobinaServilleta" = p_IdLoteBobinaServilleta
  ORDER BY tbs."NombreTipoBobinaServilleta", bs."IdBobinaServilleta";
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteLoteRodelaDetalle"(p_idloterodela integer)
 RETURNS TABLE("CodigoRodela" text, "NombreTipoRodela" text, "TipoEstado" text, "FechaRecepcion" date, "NombreProveedor" text, "CantidadRodelas" bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    r."CodigoRodela",
    tr."NombreTipoRodela",
    emp."TipoEstado",
    lr."FechaRecepcion",
    p."NombreProveedor",
    COUNT(*) OVER () AS "CantidadRodelas"
  FROM "Rodela" r
  JOIN "LoteRodela" lr ON r."IdLoteRodela" = lr."IdLoteRodela"
  JOIN "Proveedor" p ON p."IdProveedor" = lr."IdProveedor"
  JOIN "TipoRodela" tr ON r."IdTipoRodela" = tr."IdTipoRodela"
  JOIN "EstadoMateriaPrima" emp ON r."IdEstadoMateriaPrima" = emp."IdEstadoMateriaPrima"
  WHERE r."IdLoteRodela" = p_IdLoteRodela
  ORDER BY tr."NombreTipoRodela", r."CodigoRodela";
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteMovimientosOperadorLogs"(p_idproduccion integer)
 RETURNS TABLE("IdMovimientoOperadorLogs" integer, "IdProduccionBobinaTubo" integer, "CantidadLogs" integer, "FechaMovimiento" timestamp without time zone, "Observacion" text, "NombreMovimiento" text, "Ci" text, "PrimerNombre" text, "ApellidoPaterno" text, "NombreRol" text)
 LANGUAGE sql
AS $function$
  SELECT
    mol."IdMovimientoOperadorLogs", mol."IdProduccionBobinaTubo", mol."CantidadLogs",
    mol."FechaMovimiento", mol."Observacion",
    tmol."NombreMovimiento",
    u."Ci", u."PrimerNombre", u."ApellidoPaterno",
    r."NombreRol"
  FROM "MovimientoOperadorLogs" AS mol
  INNER JOIN "TipoMovimientoOperadorLogs" AS tmol
    ON mol."IdTipoMovimientoOperadorLogs" = tmol."IdTipoMovimientoOperadorLogs"
  INNER JOIN "Usuario" AS u
    ON mol."IdUsuario" = u."IdUsuario"
  INNER JOIN "Rol" AS r
    ON u."IdRol" = r."IdRol"
  WHERE mol."IdProduccionBobinaTubo" = p_IdProduccion
  ORDER BY mol."FechaMovimiento" ASC;
$function$
;

CREATE OR REPLACE FUNCTION public."ReportePausasProduccionBobinaTubo"(p_idproduccion integer DEFAULT NULL::integer, p_fechainicio date DEFAULT NULL::date, p_fechafin date DEFAULT NULL::date, p_idturno integer DEFAULT NULL::integer, p_soloabiertas boolean DEFAULT NULL::boolean)
 RETURNS TABLE("IdPausaProduccionBobinaTubo" integer, "IdProduccionBobinaTubo" integer, "CodigoBobina1" text, "CodigoBobina2" text, "NombreTurno" text, "FechaHoraPausa" timestamp with time zone, "MotivoPausaProduccion" text, "FechaHoraReanudacion" timestamp with time zone, "DuracionPausa" interval, "OperadorPausa" text, "RolPausa" text, "EstadoPausa" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    ppbt."IdPausaProduccionBobinaTubo",
    ppbt."IdProduccionBobinaTubo",
    bp1."CodigoBobina" AS "CodigoBobina1",
    bp2."CodigoBobina" AS "CodigoBobina2",
    t."NombreTurno",
    ppbt."FechaHoraPausa",
    ppbt."MotivoPausaProduccion",
    ppbt."FechaHoraReanudacion",
    ppbt."FechaHoraReanudacion" - ppbt."FechaHoraPausa" AS "DuracionPausa",
    u."PrimerNombre" || ' ' || u."ApellidoPaterno" AS "OperadorPausa",
    r."NombreRol" AS "RolPausa",
    CASE
      WHEN ppbt."FechaHoraReanudacion" IS NULL THEN 'Abierta'
      ELSE 'Cerrada'
    END AS "EstadoPausa"
  FROM "PausaProduccionBobinaTubo" ppbt
  JOIN "ProduccionBobinaTubo" pbt ON pbt."IdProduccionBobinaTubo" = ppbt."IdProduccionBobinaTubo"
  JOIN "BobinaPapel" bp1 ON bp1."IdBobinaPapel" = pbt."IdBobina_1"
  JOIN "BobinaPapel" bp2 ON bp2."IdBobinaPapel" = pbt."IdBobina_2"
  JOIN "Turno" t ON t."IdTurno" = pbt."IdTurno"
  JOIN "Usuario" u ON u."IdUsuario" = ppbt."IdUsuario"
  JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE
    (p_IdProduccion IS NULL OR ppbt."IdProduccionBobinaTubo" = p_IdProduccion)
    AND (p_FechaInicio IS NULL OR ppbt."FechaHoraPausa" >= p_FechaInicio)
    AND (p_FechaFin IS NULL OR ppbt."FechaHoraPausa" < (p_FechaFin + 1))
    AND (p_IdTurno IS NULL OR pbt."IdTurno" = p_IdTurno)
    AND (
      p_SoloAbiertas IS NULL
      OR (p_SoloAbiertas IS TRUE AND ppbt."FechaHoraReanudacion" IS NULL)
      OR (p_SoloAbiertas IS FALSE AND ppbt."FechaHoraReanudacion" IS NOT NULL)
    )
  ORDER BY ppbt."FechaHoraPausa" DESC;
$function$
;

CREATE OR REPLACE FUNCTION public."ReportePausasProduccionServilleta"(p_idproduccion integer DEFAULT NULL::integer, p_fechainicio date DEFAULT NULL::date, p_fechafin date DEFAULT NULL::date, p_idturno integer DEFAULT NULL::integer, p_soloabiertas boolean DEFAULT NULL::boolean)
 RETURNS TABLE("IdPausaProduccionServilleta" integer, "IdProduccionServilleta" integer, "CodigoBobina" text, "NombreTurno" text, "FechaHoraPausa" timestamp with time zone, "MotivoPausaProduccion" text, "FechaHoraReanudacion" timestamp with time zone, "DuracionPausa" interval, "OperadorPausa" text, "RolPausa" text, "EstadoPausa" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    pps."IdPausaProduccionServilleta",
    pps."IdProduccionServilleta",
    ubs."CodigoBobina",
    t."NombreTurno",
    pps."FechaHoraPausa",
    pps."MotivoPausaProduccion",
    pps."FechaHoraReanudacion",
    pps."FechaHoraReanudacion" - pps."FechaHoraPausa" AS "DuracionPausa",
    u."PrimerNombre" || ' ' || u."ApellidoPaterno" AS "OperadorPausa",
    r."NombreRol" AS "RolPausa",
    CASE
      WHEN pps."FechaHoraReanudacion" IS NULL THEN 'Abierta'
      ELSE 'Cerrada'
    END AS "EstadoPausa"
  FROM "PausaProduccionServilleta" pps
  JOIN "ProduccionServilleta" ps ON ps."IdProduccionServilleta" = pps."IdProduccionServilleta"
  JOIN "SubBobinaServilleta" sbs ON sbs."IdSubBobinaServilleta" = ps."IdSubBobina"
  JOIN "UnidadBobinaServilleta" ubs ON ubs."IdUnidadBobinaServilleta" = sbs."IdUnidadBobinaServilleta"
  JOIN "Turno" t ON t."IdTurno" = ps."IdTurno"
  JOIN "Usuario" u ON u."IdUsuario" = pps."IdUsuario"
  JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE
    (p_IdProduccion IS NULL OR pps."IdProduccionServilleta" = p_IdProduccion)
    AND (p_FechaInicio IS NULL OR pps."FechaHoraPausa" >= p_FechaInicio)
    AND (p_FechaFin IS NULL OR pps."FechaHoraPausa" < (p_FechaFin + 1))
    AND (p_IdTurno IS NULL OR ps."IdTurno" = p_IdTurno)
    AND (
      p_SoloAbiertas IS NULL
      OR (p_SoloAbiertas IS TRUE AND pps."FechaHoraReanudacion" IS NULL)
      OR (p_SoloAbiertas IS FALSE AND pps."FechaHoraReanudacion" IS NOT NULL)
    )
  ORDER BY pps."FechaHoraPausa" DESC;
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteProduccionBobinaTuboDetalle"(p_idproduccion integer)
 RETURNS TABLE("IdProduccionBobinaTubo" integer, "NombreEstadoProduccion" text, "NombreTurno" text, "Operador" text, "Ci" text, "NombreRol" text, "TipoBobina" text, "CodigoBobina1" text, "PesoNeto1" numeric, "Gramaje1" numeric, "Proveedor1" text, "Recepcion1" date, "CodigoBobina2" text, "PesoNeto2" numeric, "Gramaje2" numeric, "Proveedor2" text, "Recepcion2" date, "FechaInicioProduccion" timestamp with time zone, "FechaFinProduccion" timestamp with time zone, "DuracionTotal" interval, "CantidadLogsActual" integer)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    pbt."IdProduccionBobinaTubo",
    ep."NombreEstadoProduccion",
    t."NombreTurno",
    u."PrimerNombre" || ' ' || u."ApellidoPaterno" AS "Operador",
    u."Ci",
    r."NombreRol",
    tb1."NombreTipoBobina" AS "TipoBobina",
    bp1."CodigoBobina" AS "CodigoBobina1",
    bp1."PesoNetoKg" AS "PesoNeto1",
    bp1."Gramaje" AS "Gramaje1",
    pv1."NombreProveedor" AS "Proveedor1",
    lb1."FechaRecepcion" AS "Recepcion1",
    bp2."CodigoBobina" AS "CodigoBobina2",
    bp2."PesoNetoKg" AS "PesoNeto2",
    bp2."Gramaje" AS "Gramaje2",
    pv2."NombreProveedor" AS "Proveedor2",
    lb2."FechaRecepcion" AS "Recepcion2",
    pbt."FechaInicioProduccion",
    pbt."FechaFinProduccion",
    pbt."FechaFinProduccion" - pbt."FechaInicioProduccion" AS "DuracionTotal",
    pbt."CantidadLogsActual"
  FROM "ProduccionBobinaTubo" pbt
  JOIN "BobinaPapel" bp1 ON bp1."IdBobinaPapel" = pbt."IdBobina_1"
  JOIN "BobinaPapel" bp2 ON bp2."IdBobinaPapel" = pbt."IdBobina_2"
  JOIN "TipoBobina" tb1 ON tb1."IdTipoBobina" = bp1."IdTipoBobina"
  JOIN "LoteBobina" lb1 ON lb1."IdLoteBobina" = bp1."IdLoteBobina"
  JOIN "LoteBobina" lb2 ON lb2."IdLoteBobina" = bp2."IdLoteBobina"
  JOIN "Proveedor" pv1 ON pv1."IdProveedor" = lb1."IdProveedor"
  JOIN "Proveedor" pv2 ON pv2."IdProveedor" = lb2."IdProveedor"
  JOIN "Turno" t ON t."IdTurno" = pbt."IdTurno"
  JOIN "EstadoProduccion" ep ON ep."IdEstadoProduccion" = pbt."IdEstadoProduccion"
  JOIN "Usuario" u ON u."IdUsuario" = pbt."IdUsuario"
  JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE pbt."IdProduccionBobinaTubo" = p_IdProduccion;
$function$
;

CREATE OR REPLACE FUNCTION public."ReporteProduccionServilletaDetalle"(p_idproduccion integer)
 RETURNS TABLE("IdProduccionServilleta" integer, "NombreEstadoProduccion" text, "NombreTurno" text, "Operador" text, "Ci" text, "NombreRol" text, "NombreTipoBobinaServilleta" text, "CodigoBobina" text, "DescripcionMedida" text, "IdSubBobinaServilleta" integer, "PesoBrutoKg" numeric, "GramajeGr" numeric, "NombreProveedor" text, "FechaRecepcion" date, "FechaInicioProduccion" timestamp with time zone, "FechaFinProduccion" timestamp with time zone, "DuracionTotal" interval)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    ps."IdProduccionServilleta",
    ep."NombreEstadoProduccion",
    t."NombreTurno",
    u."PrimerNombre" || ' ' || u."ApellidoPaterno" AS "Operador",
    u."Ci",
    r."NombreRol",
    tbs."NombreTipoBobinaServilleta",
    ubs."CodigoBobina",
    tms."Descripcion" AS "DescripcionMedida",
    sbs."IdSubBobinaServilleta",
    ubs."PesoBrutoKg",
    ubs."GramajeGr",
    p."NombreProveedor",
    lbs."FechaRecepcion",
    ps."FechaInicioProduccion",
    ps."FechaFinProduccion",
    ps."FechaFinProduccion" - ps."FechaInicioProduccion" AS "DuracionTotal"
  FROM "ProduccionServilleta" ps
  JOIN "EstadoProduccion" ep ON ep."IdEstadoProduccion" = ps."IdEstadoProduccion"
  JOIN "Turno" t ON t."IdTurno" = ps."IdTurno"
  JOIN "SubBobinaServilleta" sbs ON sbs."IdSubBobinaServilleta" = ps."IdSubBobina"
  JOIN "TipoMedidaSubBobina" tms ON tms."IdTipoMedidaSubBobina" = sbs."IdTipoMedidaSubBobina"
  JOIN "UnidadBobinaServilleta" ubs ON ubs."IdUnidadBobinaServilleta" = sbs."IdUnidadBobinaServilleta"
  JOIN "BobinaServilleta" bs ON bs."IdBobinaServilleta" = ubs."IdBobinaServilleta"
  JOIN "TipoBobinaServilleta" tbs ON tbs."IdTipoBobinaServilleta" = bs."IdTipoBobinaServilleta"
  JOIN "LoteBobinaServilleta" lbs ON lbs."IdLoteBobinaServilleta" = bs."IdLoteBobinaServilleta"
  JOIN "Proveedor" p ON p."IdProveedor" = lbs."IdProveedor"
  JOIN "Usuario" u ON u."IdUsuario" = ps."IdUsuario"
  JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE ps."IdProduccionServilleta" = p_IdProduccion;
$function$
;

CREATE OR REPLACE FUNCTION public."ResolverCorreoPorCi"(p_ci text)
 RETURNS TABLE("CorreoOut" text, "IdEstadoUsuarioOut" integer, "NombreEstadoUsuarioOut" text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth'
AS $function$
BEGIN
    RETURN QUERY
    SELECT au.email::TEXT,
           u."IdEstadoUsuario",
           eu."NombreEstadoUsuario"
      FROM public."Usuario" u
      JOIN auth.users au ON au.id = u."AuthUserId"
      JOIN public."EstadoUsuario" eu ON eu."IdEstadoUsuario" = u."IdEstadoUsuario"
     WHERE u."Ci" = p_Ci;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."SalidaInsumoInventario"(p_idtipoinsumo integer, p_idusuario integer, p_cantidadmovimiento numeric, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdTipoInsumo" integer, "NombreInsumo" text, "CantidadDescontada" numeric, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_CantidadDisponible NUMERIC;
  v_CantidadActual NUMERIC;
  v_Observacion TEXT;
  c_IdTipoMovimientoTraslado CONSTANT INTEGER := 2;
BEGIN
  IF p_CantidadMovimiento IS NULL OR p_CantidadMovimiento <= 0 THEN
    RAISE EXCEPTION 'La cantidad a descontar debe ser mayor a 0.';
  END IF;

  v_Observacion := COALESCE(p_Observacion, 'Salida de insumo desde inventario');

  SELECT ii."CantidadActual" INTO v_CantidadDisponible
  FROM "InventarioInsumo" AS ii
  WHERE ii."IdTipoInsumo" = p_IdTipoInsumo
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe inventario registrado para IdTipoInsumo = %', p_IdTipoInsumo;
  END IF;

  IF v_CantidadDisponible < p_CantidadMovimiento THEN
    RAISE EXCEPTION 'Stock insuficiente para IdTipoInsumo = % (disponible: %, solicitado: %)', p_IdTipoInsumo, v_CantidadDisponible, p_CantidadMovimiento;
  END IF;

  UPDATE "InventarioInsumo" AS ii
  SET "CantidadActual" = ii."CantidadActual" - p_CantidadMovimiento
  WHERE ii."IdTipoInsumo" = p_IdTipoInsumo
  RETURNING ii."CantidadActual" INTO v_CantidadActual;

  INSERT INTO "MovimientoInsumo" AS mi (
    "IdTipoInsumo", "IdTipoMovimiento", "IdUsuario", "CantidadMovimiento", "Observacion"
  ) VALUES (
    p_IdTipoInsumo,
    c_IdTipoMovimientoTraslado,
    p_IdUsuario,
    p_CantidadMovimiento,
    v_Observacion
  );

  RETURN QUERY
  SELECT
    ti."IdTipoInsumo",
    ti."NombreInsumo",
    p_CantidadMovimiento,
    v_CantidadActual
  FROM "TipoInsumo" AS ti
  WHERE ti."IdTipoInsumo" = p_IdTipoInsumo;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."TrasladarEmpaquesAProduccion"(p_idsempaque integer[], p_idusuario integer)
 RETURNS TABLE("IdEmpaque" integer, "CodigoEmpaque" text, "IdEstadoMateriaPrima" integer, "FechaMovimiento" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEmpaque       INTEGER;
  v_EstadoActual    INTEGER;
  v_CodigoEmpaque   TEXT;
  v_IdEstadoAlmacen CONSTANT INTEGER := 1;
  v_IdEstadoAgotado CONSTANT INTEGER := 3;
  v_IdTipoMovimiento CONSTANT INTEGER := 2; -- Traslado a producción
BEGIN
  IF p_IdsEmpaque IS NULL OR array_length(p_IdsEmpaque, 1) IS NULL THEN
    RAISE EXCEPTION 'Debe proporcionar al menos un IdEmpaque.';
  END IF;

  FOREACH v_IdEmpaque IN ARRAY p_IdsEmpaque
  LOOP
    SELECT e."IdEstadoMateriaPrima", e."CodigoEmpaque"
    INTO v_EstadoActual, v_CodigoEmpaque
    FROM "Empaque" AS e
    WHERE e."IdEmpaque" = v_IdEmpaque
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'No existe el empaque con IdEmpaque = %', v_IdEmpaque;
    END IF;

    IF v_EstadoActual <> v_IdEstadoAlmacen THEN
      RAISE EXCEPTION 'El empaque % (código %) no está En almacén (estado actual: %), no puede trasladarse a producción', v_IdEmpaque, v_CodigoEmpaque, v_EstadoActual;
    END IF;

    UPDATE "Empaque" AS e
    SET "IdEstadoMateriaPrima" = v_IdEstadoAgotado
    WHERE e."IdEmpaque" = v_IdEmpaque;

    INSERT INTO "MovimientoEmpaque" AS me ("IdEmpaque", "IdTipoMovimiento", "IdUsuario", "Observacion")
    VALUES (v_IdEmpaque, v_IdTipoMovimiento, p_IdUsuario, 'Empaque trasladado a producción');
  END LOOP;

  RETURN QUERY
  SELECT
    e."IdEmpaque",
    e."CodigoEmpaque",
    e."IdEstadoMateriaPrima",
    mb."FechaMovimiento"
  FROM "Empaque" AS e
  INNER JOIN LATERAL (
    SELECT mb."FechaMovimiento"
    FROM "MovimientoEmpaque" AS mb
    WHERE mb."IdEmpaque" = e."IdEmpaque"
    ORDER BY mb."FechaMovimiento" DESC
    LIMIT 1
  ) AS mb ON true
  WHERE e."IdEmpaque" = ANY(p_IdsEmpaque);
END;
$function$
;

CREATE OR REPLACE FUNCTION public."TrasladarRodelaAProduccion"(p_idrodela integer, p_idusuario integer, p_observacion text DEFAULT NULL::text)
 RETURNS TABLE("IdRodela" integer, "CodigoRodela" text, "IdEstadoMateriaPrima" integer, "FechaMovimiento" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_IdEstadoActual   INTEGER;
  v_CodigoRodela     TEXT;
  v_FechaMovimiento  TIMESTAMPTZ;
  c_IdEstadoAlmacen           CONSTANT INTEGER := 1;
  c_IdEstadoAbierta           CONSTANT INTEGER := 6;
  c_IdTipoMovimientoTraslado  CONSTANT INTEGER := 2;  -- fila de TipoMovimientoMateriaPrima con AplicaA que incluya 'Rodela'
BEGIN
  IF p_IdRodela IS NULL THEN
    RAISE EXCEPTION 'IdRodela es obligatorio para trasladar a producción.';
  END IF;

  SELECT r."IdEstadoMateriaPrima", r."CodigoRodela"
  INTO v_IdEstadoActual, v_CodigoRodela
  FROM "Rodela" r
  WHERE r."IdRodela" = p_IdRodela
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la rodela con IdRodela = %', p_IdRodela;
  END IF;

  IF v_IdEstadoActual <> c_IdEstadoAlmacen THEN
    RAISE EXCEPTION 'La rodela % no está En almacén (estado actual: %), no puede trasladarse a producción', p_IdRodela, v_IdEstadoActual;
  END IF;

  UPDATE "Rodela" AS r
  SET "IdEstadoMateriaPrima" = c_IdEstadoAbierta
  WHERE r."IdRodela" = p_IdRodela;

  INSERT INTO "MovimientoRodela" AS mr ("IdRodela", "IdTipoMovimiento", "IdUsuario", "Observacion")
  VALUES (
    p_IdRodela,
    c_IdTipoMovimientoTraslado,
    p_IdUsuario,
    COALESCE(p_Observacion, 'Traslado a producción - apertura de paquete de rodelas')
  )
  RETURNING mr."FechaMovimiento" INTO v_FechaMovimiento;

  RETURN QUERY
  SELECT p_IdRodela, v_CodigoRodela, c_IdEstadoAbierta, v_FechaMovimiento;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerBobinaPapelInventario"(p_idtipobobina integer, p_idestadomateriaprima integer)
 RETURNS TABLE("IdBobinaPapel" integer, "CodigoBobina" text, "NombreTipoBobina" text, "PesoBrutoKg" numeric, "Gramaje" numeric, "FechaRecepcion" date, "NombreProveedor" text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    bp."IdBobinaPapel",
    bp."CodigoBobina",
    tb."NombreTipoBobina",
    bp."PesoBrutoKg",
    bp."Gramaje",
    lb."FechaRecepcion",
    pro."NombreProveedor"
  FROM "BobinaPapel" AS bp
  INNER JOIN "TipoBobina" AS tb
    ON tb."IdTipoBobina" = bp."IdTipoBobina"
  INNER JOIN "LoteBobina" AS lb
    ON lb."IdLoteBobina" = bp."IdLoteBobina"
  INNER JOIN "Proveedor" AS pro
    ON lb."IdProveedor" = pro."IdProveedor"
  WHERE bp."IdTipoBobina" = p_IdTipoBobina
    AND bp."IdEstadoMateriaPrima" = p_IdEstadoMateriaPrima;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerBobinaServilletaInventario"()
 RETURNS TABLE("IdBobinaServilleta" integer, "IdTipoBobinaServilleta" integer, "NombreTipoBobinaServilleta" text, "FechaRecepcion" date, "NombreProveedor" text, "IdUnidad1" integer, "CodigoUnidad1" text, "IdFormatoSubBobina1" integer, "DescripcionFormato1" text, "IdUnidad2" integer, "CodigoUnidad2" text, "IdFormatoSubBobina2" integer, "DescripcionFormato2" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoAlmacen CONSTANT INTEGER := 1;
BEGIN
  RETURN QUERY
  SELECT
    bs."IdBobinaServilleta",
    tbs."IdTipoBobinaServilleta",
    tbs."NombreTipoBobinaServilleta",
    bs."FechaRecepcion",
    pro."NombreProveedor",
    u1."IdUnidadBobinaServilleta",
    u1."CodigoBobina",
    fsb1."IdFormatoSubBobina",
    fsb1."DescripcionFormato",
    u2."IdUnidadBobinaServilleta",
    u2."CodigoBobina",
    fsb2."IdFormatoSubBobina",
    fsb2."DescripcionFormato"
  FROM "BobinaServilleta" AS bs
  INNER JOIN "TipoBobinaServilleta" AS tbs
    ON tbs."IdTipoBobinaServilleta" = bs."IdTipoBobinaServilleta"
  INNER JOIN "LoteBobina" AS lb
    ON lb."IdLoteBobina" = bs."IdLoteBobina"
  INNER JOIN "Proveedor" AS pro
    ON pro."IdProveedor" = lb."IdProveedor"
  INNER JOIN LATERAL (
    SELECT ub."IdUnidadBobinaServilleta", ub."CodigoBobina", ub."IdFormatoSubBobina"
    FROM "UnidadBobinaServilleta" ub
    WHERE ub."IdBobinaServilleta" = bs."IdBobinaServilleta"
    ORDER BY ub."IdUnidadBobinaServilleta"
    LIMIT 1
  ) AS u1 ON true
  INNER JOIN "FormatoSubBobina" AS fsb1
    ON fsb1."IdFormatoSubBobina" = u1."IdFormatoSubBobina"
  INNER JOIN LATERAL (
    SELECT ub."IdUnidadBobinaServilleta", ub."CodigoBobina", ub."IdFormatoSubBobina"
    FROM "UnidadBobinaServilleta" ub
    WHERE ub."IdBobinaServilleta" = bs."IdBobinaServilleta"
    ORDER BY ub."IdUnidadBobinaServilleta"
    OFFSET 1 LIMIT 1
  ) AS u2 ON true
  INNER JOIN "FormatoSubBobina" AS fsb2
    ON fsb2."IdFormatoSubBobina" = u2."IdFormatoSubBobina"
  WHERE bs."IdEstadoMateriaPrima" = c_IdEstadoAlmacen
  ORDER BY bs."IdBobinaServilleta";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerBobinasPapel"(p_codigobobina text DEFAULT NULL::text, p_idproveedor integer DEFAULT NULL::integer, p_idstipobobina integer[] DEFAULT NULL::integer[], p_idestadomateriaprima integer DEFAULT NULL::integer, p_idbobinapapel integer DEFAULT NULL::integer)
 RETURNS TABLE("IdBobinaPapel" integer, "CodigoBobina" text, "PesoBrutoKg" numeric, "Gramaje" numeric, "NombreTipoBobina" text, "TipoEstado" text, "NombreProveedor" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    bp."IdBobinaPapel",
    bp."CodigoBobina",
    bp."PesoBrutoKg",
    bp."Gramaje",
    tb."NombreTipoBobina",
    emp."TipoEstado",
    p."NombreProveedor"
  FROM "BobinaPapel" bp
  JOIN "TipoBobina" tb ON bp."IdTipoBobina" = tb."IdTipoBobina"
  JOIN "EstadoMateriaPrima" emp ON bp."IdEstadoMateriaPrima" = emp."IdEstadoMateriaPrima"
  JOIN "LoteBobina" lb ON bp."IdLoteBobina" = lb."IdLoteBobina"
  JOIN "Proveedor" p ON p."IdProveedor" = lb."IdProveedor"
  WHERE
    (p_CodigoBobina IS NULL OR bp."CodigoBobina" = p_CodigoBobina)
    AND (p_IdProveedor IS NULL OR lb."IdProveedor" = p_IdProveedor)
    AND (p_IdsTipoBobina IS NULL OR bp."IdTipoBobina" = ANY(p_IdsTipoBobina))
    AND (p_IdEstadoMateriaPrima IS NULL OR bp."IdEstadoMateriaPrima" = p_IdEstadoMateriaPrima)
    AND (p_IdBobinaPapel IS NULL OR bp."IdBobinaPapel" = p_IdBobinaPapel)
  ORDER BY bp."CodigoBobina";
$function$
;

CREATE OR REPLACE FUNCTION public."VerBobinasPapelFueraInventario"()
 RETURNS TABLE("IdBobinaPapel" integer, "CodigoBobina" text, "NombreTipoBobina" text, "PesoBrutoKg" numeric, "Gramaje" numeric, "NombreProveedor" text, "FechaRecepcion" date, "UltimaObservacion" text, "FechaUltimoMovimiento" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoFueraInventario CONSTANT INTEGER := 5;
BEGIN
  RETURN QUERY
  SELECT
    bp."IdBobinaPapel",
    bp."CodigoBobina",
    tb."NombreTipoBobina",
    bp."PesoBrutoKg",
    bp."Gramaje",
    pro."NombreProveedor",
    lb."FechaRecepcion",
    um."Observacion",
    um."FechaMovimiento"
  FROM "BobinaPapel" AS bp
  INNER JOIN "TipoBobina" AS tb
    ON tb."IdTipoBobina" = bp."IdTipoBobina"
  INNER JOIN "LoteBobina" AS lb
    ON lb."IdLoteBobina" = bp."IdLoteBobina"
  INNER JOIN "Proveedor" AS pro
    ON pro."IdProveedor" = lb."IdProveedor"
  LEFT JOIN LATERAL (
    SELECT mb."Observacion", mb."FechaMovimiento"
    FROM "MovimientoBobina" AS mb
    WHERE mb."IdBobinaPapel" = bp."IdBobinaPapel"
    ORDER BY mb."FechaMovimiento" DESC
    LIMIT 1
  ) AS um ON true
  WHERE bp."IdEstadoMateriaPrima" = c_IdEstadoFueraInventario
  ORDER BY um."FechaMovimiento" DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerBobinasServilleta"(p_codigobobina text DEFAULT NULL::text, p_idproveedor integer DEFAULT NULL::integer, p_idtipobobinaservilleta integer DEFAULT NULL::integer, p_idestadomateriaprima integer DEFAULT NULL::integer, p_idbobinaservilleta integer DEFAULT NULL::integer)
 RETURNS TABLE("IdBobinaServilleta" integer, "TipoEstado" text, "NombreTipoBobinaServilleta" text, "CodigoLote" text, "FechaRecepcion" date, "NombreProveedor" text, "IdUnidad1" integer, "CodigoUnidad1" text, "DescripcionFormato1" text, "PesoBrutoKg1" numeric, "GramajeGr1" numeric, "IdUnidad2" integer, "CodigoUnidad2" text, "DescripcionFormato2" text, "PesoBrutoKg2" numeric, "GramajeGr2" numeric)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    bs."IdBobinaServilleta",
    emp."TipoEstado",
    tbs."NombreTipoBobinaServilleta",
    lbs."IdLoteBobinaServilleta"::text AS "CodigoLote",
    lbs."FechaRecepcion",
    p."NombreProveedor",
    u1."IdUnidadBobinaServilleta" AS "IdUnidad1",
    u1."CodigoBobina"         AS "CodigoUnidad1",
    fsb1."DescripcionFormato" AS "DescripcionFormato1",
    u1."PesoBrutoKg"          AS "PesoBrutoKg1",
    u1."GramajeGr"            AS "GramajeGr1",
    u2."IdUnidadBobinaServilleta" AS "IdUnidad2",
    u2."CodigoBobina"         AS "CodigoUnidad2",
    fsb2."DescripcionFormato" AS "DescripcionFormato2",
    u2."PesoBrutoKg"          AS "PesoBrutoKg2",
    u2."GramajeGr"            AS "GramajeGr2"
  FROM "BobinaServilleta" bs
  JOIN "EstadoMateriaPrima" emp ON emp."IdEstadoMateriaPrima" = bs."IdEstadoMateriaPrima"
  JOIN "TipoBobinaServilleta" tbs ON tbs."IdTipoBobinaServilleta" = bs."IdTipoBobinaServilleta"
  JOIN "LoteBobinaServilleta" lbs ON lbs."IdLoteBobinaServilleta" = bs."IdLoteBobinaServilleta"
  JOIN "Proveedor" p ON p."IdProveedor" = lbs."IdProveedor"
  LEFT JOIN LATERAL (
    SELECT ub."IdUnidadBobinaServilleta", ub."CodigoBobina", ub."IdFormatoSubBobina", ub."PesoBrutoKg", ub."GramajeGr"
    FROM "UnidadBobinaServilleta" ub
    WHERE ub."IdBobinaServilleta" = bs."IdBobinaServilleta"
    ORDER BY ub."IdUnidadBobinaServilleta"
    LIMIT 1
  ) u1 ON true
  LEFT JOIN "FormatoSubBobina" fsb1 ON fsb1."IdFormatoSubBobina" = u1."IdFormatoSubBobina"
  LEFT JOIN LATERAL (
    SELECT ub."IdUnidadBobinaServilleta", ub."CodigoBobina", ub."IdFormatoSubBobina", ub."PesoBrutoKg", ub."GramajeGr"
    FROM "UnidadBobinaServilleta" ub
    WHERE ub."IdBobinaServilleta" = bs."IdBobinaServilleta"
    ORDER BY ub."IdUnidadBobinaServilleta"
    OFFSET 1 LIMIT 1
  ) u2 ON true
  LEFT JOIN "FormatoSubBobina" fsb2 ON fsb2."IdFormatoSubBobina" = u2."IdFormatoSubBobina"
  WHERE
    (p_CodigoBobina IS NULL OR u1."CodigoBobina" = p_CodigoBobina OR u2."CodigoBobina" = p_CodigoBobina)
    AND (p_IdProveedor IS NULL OR lbs."IdProveedor" = p_IdProveedor)
    AND (p_IdTipoBobinaServilleta IS NULL OR bs."IdTipoBobinaServilleta" = p_IdTipoBobinaServilleta)
    AND (p_IdEstadoMateriaPrima IS NULL OR bs."IdEstadoMateriaPrima" = p_IdEstadoMateriaPrima)
    AND (p_IdBobinaServilleta IS NULL OR bs."IdBobinaServilleta" = p_IdBobinaServilleta)
  ORDER BY lbs."FechaRecepcion" DESC, bs."IdBobinaServilleta";
$function$
;

CREATE OR REPLACE FUNCTION public."VerCancelacionesProduccionBobinaTubo"(p_fechainicio date DEFAULT NULL::date, p_fechafin date DEFAULT NULL::date)
 RETURNS TABLE("IdProduccionBobinaTubo" integer, "FechaHoraCancelacion" timestamp with time zone, "MotivoCancelacion" text, "Ci" text, "PrimerNombre" text, "ApellidoPaterno" text, "NombreRol" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    cpbt."IdProduccionBobinaTubo",
    cpbt."FechaHoraCancelacion",
    cpbt."MotivoCancelacion",
    u."Ci",
    u."PrimerNombre",
    u."ApellidoPaterno",
    r."NombreRol"
  FROM "CancelacionProduccionBobinaTubo" cpbt
  JOIN "Usuario" u ON u."IdUsuario" = cpbt."IdUsuario"
  JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE
    (p_FechaInicio IS NULL OR cpbt."FechaHoraCancelacion" >= p_FechaInicio)
    AND (p_FechaFin IS NULL OR cpbt."FechaHoraCancelacion" < (p_FechaFin + 1))
  ORDER BY cpbt."FechaHoraCancelacion" DESC;
$function$
;

CREATE OR REPLACE FUNCTION public."VerCancelacionesProduccionServilleta"(p_fechainicio date DEFAULT NULL::date, p_fechafin date DEFAULT NULL::date)
 RETURNS TABLE("IdProduccionServilleta" integer, "FechaHoraCancelacion" timestamp with time zone, "MotivoCancelacion" text, "Ci" text, "PrimerNombre" text, "ApellidoPaterno" text, "NombreRol" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    cps."IdProduccionServilleta",
    cps."FechaHoraCancelacion",
    cps."MotivoCancelacion",
    u."Ci",
    u."PrimerNombre",
    u."ApellidoPaterno",
    r."NombreRol"
  FROM "CancelacionProduccionServilleta" cps
  JOIN "Usuario" u ON u."IdUsuario" = cps."IdUsuario"
  JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE
    (p_FechaInicio IS NULL OR cps."FechaHoraCancelacion" >= p_FechaInicio)
    AND (p_FechaFin IS NULL OR cps."FechaHoraCancelacion" < (p_FechaFin + 1))
  ORDER BY cps."FechaHoraCancelacion" DESC;
$function$
;

CREATE OR REPLACE FUNCTION public."VerCantidadBobinaServilletaEnAlmacen"()
 RETURNS TABLE("IdTipoBobinaServilleta" integer, "NombreTipoBobinaServilleta" text, "CantidadBobinaServilleta" bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoAlmacen CONSTANT INTEGER := 1;
BEGIN
  RETURN QUERY
  SELECT
    tbs."IdTipoBobinaServilleta",
    tbs."NombreTipoBobinaServilleta",
    COUNT(bs."IdBobinaServilleta") AS "CantidadBobinaServilleta"
  FROM "TipoBobinaServilleta" AS tbs
  LEFT JOIN "BobinaServilleta" AS bs
    ON bs."IdTipoBobinaServilleta" = tbs."IdTipoBobinaServilleta"
    AND bs."IdEstadoMateriaPrima" = c_IdEstadoAlmacen
  GROUP BY
    tbs."IdTipoBobinaServilleta", tbs."NombreTipoBobinaServilleta";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerCatalogoEmpaqueBolsa"()
 RETURNS TABLE("IdTipoEmpaqueBolsa" integer, "NombreEmpaqueBolsa" text, "DescripcionEmpaqueBolsa" text, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    teb."IdTipoEmpaqueBolsa",
    teb."NombreEmpaqueBolsa",
    teb."DescripcionEmpaqueBolsa",
    COALESCE(ieb."CantidadActual", 0) AS "CantidadActual"
  FROM "TipoEmpaqueBolsa" AS teb
  LEFT JOIN "InventarioEmpaqueBolsa" AS ieb
    ON ieb."IdTipoEmpaqueBolsa" = teb."IdTipoEmpaqueBolsa"
  ORDER BY teb."IdTipoEmpaqueBolsa";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerCatalogoInsumo"()
 RETURNS TABLE("IdTipoInsumo" integer, "NombreInsumo" text, "DescripcionInsumo" text, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ti."IdTipoInsumo",
    ti."NombreInsumo",
    ti."DescripcionInsumo",
    COALESCE(ii."CantidadActual", 0) AS "CantidadActual"
  FROM "TipoInsumo" AS ti
  LEFT JOIN "InventarioInsumo" AS ii
    ON ii."IdTipoInsumo" = ti."IdTipoInsumo"
  ORDER BY ti."IdTipoInsumo";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerDetalleInventarioBobinaPapel"(p_idtipobobina integer)
 RETURNS TABLE("IdBobinaPapel" integer, "CodigoBobina" text, "CodigoLote" text, "FechaRecepcion" date, "NombreProveedor" text, "PesoBrutoKg" numeric, "PesoNetoKg" numeric, "Gramaje" numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    bp."IdBobinaPapel",
    bp."CodigoBobina",
    'L-' || LPAD(lb."IdLoteBobina"::TEXT, 4, '0') AS "CodigoLote",
    lb."FechaRecepcion",
    pro."NombreProveedor",
    bp."PesoBrutoKg",
    bp."PesoNetoKg",
    bp."Gramaje"
  FROM "BobinaPapel" AS bp
  INNER JOIN "LoteBobina" AS lb
    ON lb."IdLoteBobina" = bp."IdLoteBobina"
  INNER JOIN "Proveedor" AS pro
    ON pro."IdProveedor" = lb."IdProveedor"
  WHERE bp."IdTipoBobina" = p_IdTipoBobina
    AND bp."IdEstadoMateriaPrima" = 1
  ORDER BY lb."FechaRecepcion" DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerDetalleInventarioBobinaServilleta"(p_idtipobobinaservilleta integer)
 RETURNS TABLE("IdBobinaServilleta" integer, "FechaRecepcion" date, "NombreProveedor" text, "IdUnidad1" integer, "CodigoUnidad1" text, "IdFormatoSubBobina1" integer, "DescripcionFormato1" text, "IdUnidad2" integer, "CodigoUnidad2" text, "IdFormatoSubBobina2" integer, "DescripcionFormato2" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoAlmacen CONSTANT INTEGER := 1;
BEGIN
  RETURN QUERY
  SELECT
    bs."IdBobinaServilleta",
    lbs."FechaRecepcion",
    pro."NombreProveedor",
    u1."IdUnidadBobinaServilleta",
    u1."CodigoBobina",
    fsb1."IdFormatoSubBobina",
    fsb1."DescripcionFormato",
    u2."IdUnidadBobinaServilleta",
    u2."CodigoBobina",
    fsb2."IdFormatoSubBobina",
    fsb2."DescripcionFormato"
  FROM "BobinaServilleta" AS bs
  INNER JOIN "LoteBobinaServilleta" AS lbs
    ON lbs."IdLoteBobinaServilleta" = bs."IdLoteBobinaServilleta"
  INNER JOIN "Proveedor" AS pro
    ON pro."IdProveedor" = lbs."IdProveedor"
  LEFT JOIN LATERAL (
    SELECT ub."IdUnidadBobinaServilleta", ub."CodigoBobina", ub."IdFormatoSubBobina"
    FROM "UnidadBobinaServilleta" ub
    WHERE ub."IdBobinaServilleta" = bs."IdBobinaServilleta"
    ORDER BY ub."IdUnidadBobinaServilleta"
    LIMIT 1
  ) AS u1 ON true
  LEFT JOIN "FormatoSubBobina" AS fsb1
    ON fsb1."IdFormatoSubBobina" = u1."IdFormatoSubBobina"
  LEFT JOIN LATERAL (
    SELECT ub."IdUnidadBobinaServilleta", ub."CodigoBobina", ub."IdFormatoSubBobina"
    FROM "UnidadBobinaServilleta" ub
    WHERE ub."IdBobinaServilleta" = bs."IdBobinaServilleta"
    ORDER BY ub."IdUnidadBobinaServilleta"
    OFFSET 1 LIMIT 1
  ) AS u2 ON true
  LEFT JOIN "FormatoSubBobina" AS fsb2
    ON fsb2."IdFormatoSubBobina" = u2."IdFormatoSubBobina"
  WHERE bs."IdTipoBobinaServilleta" = p_IdTipoBobinaServilleta
    AND bs."IdEstadoMateriaPrima" = c_IdEstadoAlmacen
  ORDER BY bs."IdBobinaServilleta";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerDetalleInventarioEmpaque"(p_idtipoempaque integer)
 RETURNS TABLE("IdEmpaque" integer, "CodigoEmpaque" text, "PesoKg" numeric, "FechaRecepcion" date, "NombreProveedor" text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    emp."IdEmpaque",
    emp."CodigoEmpaque",
    emp."PesoKg",
    le."FechaRecepcion",
    p."NombreProveedor"
  FROM "Empaque" AS emp
  INNER JOIN "LoteEmpaque" AS le
    ON le."IdLoteEmpaque" = emp."IdLoteEmpaque"
  INNER JOIN "Proveedor" AS p
    ON p."IdProveedor" = le."IdProveedor"
  WHERE emp."IdTipoEmpaque" = p_IdTipoEmpaque
    AND emp."IdEstadoMateriaPrima" = 1 -- En almacén
  ORDER BY le."FechaRecepcion" ASC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerDetalleInventarioRodela"(p_idtiporodela integer)
 RETURNS TABLE("IdRodela" integer, "CodigoRodela" text, "CodigoLote" text, "FechaRecepcion" date, "NombreProveedor" text, "TipoEstado" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoAlmacen CONSTANT INTEGER := 1;
  c_IdEstadoAbierta CONSTANT INTEGER := 6;
BEGIN
  RETURN QUERY
  SELECT
    r."IdRodela",
    r."CodigoRodela",
    'L-' || LPAD(lr."IdLoteRodela"::TEXT, 4, '0') AS "CodigoLote",
    lr."FechaRecepcion",
    pro."NombreProveedor",
    emp."TipoEstado"
  FROM "Rodela" AS r
  INNER JOIN "LoteRodela" AS lr
    ON lr."IdLoteRodela" = r."IdLoteRodela"
  INNER JOIN "Proveedor" AS pro
    ON pro."IdProveedor" = lr."IdProveedor"
  INNER JOIN "EstadoMateriaPrima" AS emp
    ON emp."IdEstadoMateriaPrima" = r."IdEstadoMateriaPrima"
  WHERE r."IdTipoRodela" = p_IdTipoRodela
    AND r."IdEstadoMateriaPrima" IN (c_IdEstadoAlmacen, c_IdEstadoAbierta)
  ORDER BY lr."FechaRecepcion" DESC, r."CodigoRodela";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerDetalleInventarioSubBobinaServilleta"(p_idtipomedidasubbobina integer)
 RETURNS TABLE("IdSubBobinaServilleta" integer, "CodigoUnidadOrigen" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoAlmacen CONSTANT INTEGER := 1;
BEGIN
  RETURN QUERY
  SELECT
    sb."IdSubBobinaServilleta",
    ub."CodigoBobina"
  FROM "SubBobinaServilleta" AS sb
  INNER JOIN "UnidadBobinaServilleta" AS ub
    ON ub."IdUnidadBobinaServilleta" = sb."IdUnidadBobinaServilleta"
  WHERE sb."IdEstadoMateriaPrima" = c_IdEstadoAlmacen
    AND sb."IdTipoMedidaSubBobina" = p_IdTipoMedidaSubBobina
  ORDER BY sb."IdSubBobinaServilleta";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerEmpaquesPorTipo"(p_idtipoempaque integer)
 RETURNS TABLE("IdEmpaque" integer, "CodigoEmpaque" text, "PesoKg" numeric, "NombreTipoEmpaque" text, "IdLoteEmpaque" integer, "FechaRecepcion" date, "NombreProveedor" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoAlmacen CONSTANT INTEGER := 1;
BEGIN
  RETURN QUERY
  SELECT
    e."IdEmpaque",
    e."CodigoEmpaque",
    e."PesoKg",
    te."NombreTipoEmpaque",
    le."IdLoteEmpaque",
    le."FechaRecepcion",
    pro."NombreProveedor"
  FROM "Empaque" AS e
  INNER JOIN "TipoEmpaque" AS te
    ON te."IdTipoEmpaque" = e."IdTipoEmpaque"
  INNER JOIN "LoteEmpaque" AS le
    ON le."IdLoteEmpaque" = e."IdLoteEmpaque"
  INNER JOIN "Proveedor" AS pro
    ON pro."IdProveedor" = le."IdProveedor"
  WHERE e."IdEstadoMateriaPrima" = c_IdEstadoAlmacen
    AND te."IdTipoEmpaque" = p_IdTipoEmpaque;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerInventarioBobinaPapel"(p_idtipobobina integer)
 RETURNS TABLE("IdTipoBobina" integer, "NombreTipoBobina" text, "IdEstadoMateriaPrima" integer, "TipoEstado" text, "CantidadBobinas" bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    tb."IdTipoBobina",
    tb."NombreTipoBobina",
    emp."IdEstadoMateriaPrima",
    emp."TipoEstado",
    COUNT(bp."IdBobinaPapel") AS "CantidadBobinas"
  FROM "TipoBobina" tb
  CROSS JOIN "EstadoMateriaPrima" emp
  LEFT JOIN "BobinaPapel" bp
    ON bp."IdTipoBobina" = tb."IdTipoBobina"
    AND bp."IdEstadoMateriaPrima" = emp."IdEstadoMateriaPrima"
  WHERE tb."IdTipoBobina" = p_IdTipoBobina
  GROUP BY
    tb."IdTipoBobina", tb."NombreTipoBobina",
    emp."IdEstadoMateriaPrima", emp."TipoEstado";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerInventarioEmpaque"(p_idtipoempaque integer)
 RETURNS TABLE("IdTipoEmpaque" integer, "NombreTipoEmpaque" text, "CantidadEmpaques" bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoAlmacen CONSTANT INTEGER := 1;
BEGIN
  RETURN QUERY
  SELECT
    te."IdTipoEmpaque",
    te."NombreTipoEmpaque",
    COUNT(emp."IdEmpaque") AS "CantidadEmpaques"
  FROM "TipoEmpaque" te
  LEFT JOIN "Empaque" emp
    ON emp."IdTipoEmpaque" = te."IdTipoEmpaque"
    AND emp."IdEstadoMateriaPrima" = c_IdEstadoAlmacen
  WHERE te."IdTipoEmpaque" = p_IdTipoEmpaque
  GROUP BY
    te."IdTipoEmpaque", te."NombreTipoEmpaque";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerInventarioPallet"(p_idtipopallet integer)
 RETURNS TABLE("IdTipoPallet" integer, "NumeroRodelas" integer, "Descripcion" text, "IdEstadoMateriaPrima" integer, "TipoEstado" text, "CantidadPallets" bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    tp."IdTipoPallet",
    tp."NumeroRodelas",
    tp."Descripcion",
    emp."IdEstadoMateriaPrima",
    emp."TipoEstado",
    COUNT(pa."IdPallet") AS "CantidadPallets"
  FROM "TipoPallet" tp
  CROSS JOIN "EstadoMateriaPrima" emp
  LEFT JOIN "Pallet" pa
    ON pa."IdTipoPallet" = tp."IdTipoPallet"
    AND pa."IdEstadoMateriaPrima" = emp."IdEstadoMateriaPrima"
  WHERE tp."IdTipoPallet" = p_IdTipoPallet
  GROUP BY
    tp."IdTipoPallet", tp."NumeroRodelas", tp."Descripcion",
    emp."IdEstadoMateriaPrima", emp."TipoEstado";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerInventarioProductoTerminado"(p_idproducto integer DEFAULT NULL::integer)
 RETURNS TABLE("IdPresentacion" integer, "CodigoPresentacion" text, "NombreProducto" text, "TipoContenedor" text, "CantidadRollosUnidades" integer, "CantidadPorUnidadTerminada" integer, "CantidadActual" numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    pp."IdPresentacion",
    pp."CodigoPresentacion",
    p."NombreProducto",
    pp."TipoContenedor",
    pp."CantidadRollosUnidades",
    pp."CantidadPorUnidadTerminada",
    ipt."CantidadActual"
  FROM "InventarioProductoTerminado" AS ipt
  INNER JOIN "PresentacionProducto" AS pp ON pp."IdPresentacion" = ipt."IdPresentacion"
  INNER JOIN "Producto" AS p ON p."IdProducto" = pp."IdProducto"
  WHERE p_IdProducto IS NULL OR p."IdProducto" = p_IdProducto
  ORDER BY p."NombreProducto", pp."CodigoPresentacion";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerLotesBobinaPapel"(p_fechainicio date DEFAULT NULL::date, p_fechafin date DEFAULT NULL::date, p_idproveedor integer DEFAULT NULL::integer, p_idstipobobina integer[] DEFAULT NULL::integer[])
 RETURNS TABLE("IdLoteBobina" integer, "FechaRecepcion" date, "NombreProveedor" text, "CantidadBobinas" bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    lb."IdLoteBobina",
    lb."FechaRecepcion",
    p."NombreProveedor",
    COUNT(bp."IdBobinaPapel") AS "CantidadBobinas"
  FROM "LoteBobina" lb
  JOIN "Proveedor" p ON p."IdProveedor" = lb."IdProveedor"
  LEFT JOIN "BobinaPapel" bp
    ON bp."IdLoteBobina" = lb."IdLoteBobina"
    AND (p_IdsTipoBobina IS NULL OR bp."IdTipoBobina" = ANY(p_IdsTipoBobina))
  WHERE
    (p_FechaInicio IS NULL OR lb."FechaRecepcion" >= p_FechaInicio)
    AND (p_FechaFin IS NULL OR lb."FechaRecepcion" <= p_FechaFin)
    AND (p_IdProveedor IS NULL OR lb."IdProveedor" = p_IdProveedor)
  GROUP BY lb."IdLoteBobina", lb."FechaRecepcion", p."NombreProveedor"
  HAVING (p_IdsTipoBobina IS NULL OR COUNT(bp."IdBobinaPapel") > 0)
  ORDER BY lb."FechaRecepcion" DESC;
$function$
;

CREATE OR REPLACE FUNCTION public."VerLotesBobinaServilleta"(p_fechainicio date DEFAULT NULL::date, p_fechafin date DEFAULT NULL::date, p_idproveedor integer DEFAULT NULL::integer, p_idstipobobinaservilleta integer[] DEFAULT NULL::integer[])
 RETURNS TABLE("IdLoteBobinaServilleta" integer, "FechaRecepcion" date, "NombreProveedor" text, "CantidadBobinas" bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    lbs."IdLoteBobinaServilleta",
    lbs."FechaRecepcion",
    p."NombreProveedor",
    COUNT(bs."IdBobinaServilleta") AS "CantidadBobinas"
  FROM "LoteBobinaServilleta" lbs
  JOIN "Proveedor" p ON p."IdProveedor" = lbs."IdProveedor"
  LEFT JOIN "BobinaServilleta" bs
    ON bs."IdLoteBobinaServilleta" = lbs."IdLoteBobinaServilleta"
    AND (p_IdsTipoBobinaServilleta IS NULL OR bs."IdTipoBobinaServilleta" = ANY(p_IdsTipoBobinaServilleta))
  WHERE
    (p_FechaInicio IS NULL OR lbs."FechaRecepcion" >= p_FechaInicio)
    AND (p_FechaFin IS NULL OR lbs."FechaRecepcion" <= p_FechaFin)
    AND (p_IdProveedor IS NULL OR lbs."IdProveedor" = p_IdProveedor)
  GROUP BY lbs."IdLoteBobinaServilleta", lbs."FechaRecepcion", p."NombreProveedor"
  HAVING (p_IdsTipoBobinaServilleta IS NULL OR COUNT(bs."IdBobinaServilleta") > 0)
  ORDER BY lbs."FechaRecepcion" DESC;
$function$
;

CREATE OR REPLACE FUNCTION public."VerLotesRodela"(p_fechainicio date DEFAULT NULL::date, p_fechafin date DEFAULT NULL::date, p_idproveedor integer DEFAULT NULL::integer, p_idstiporodela integer[] DEFAULT NULL::integer[])
 RETURNS TABLE("IdLoteRodela" integer, "FechaRecepcion" date, "NombreProveedor" text, "CantidadRodelas" bigint)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    lr."IdLoteRodela",
    lr."FechaRecepcion",
    p."NombreProveedor",
    COUNT(r."IdRodela") AS "CantidadRodelas"
  FROM "LoteRodela" lr
  JOIN "Proveedor" p ON p."IdProveedor" = lr."IdProveedor"
  LEFT JOIN "Rodela" r
    ON r."IdLoteRodela" = lr."IdLoteRodela"
    AND (p_IdsTipoRodela IS NULL OR r."IdTipoRodela" = ANY(p_IdsTipoRodela))
  WHERE
    (p_FechaInicio IS NULL OR lr."FechaRecepcion" >= p_FechaInicio)
    AND (p_FechaFin IS NULL OR lr."FechaRecepcion" <= p_FechaFin)
    AND (p_IdProveedor IS NULL OR lr."IdProveedor" = p_IdProveedor)
  GROUP BY lr."IdLoteRodela", lr."FechaRecepcion", p."NombreProveedor"
  HAVING (p_IdsTipoRodela IS NULL OR COUNT(r."IdRodela") > 0)
  ORDER BY lr."FechaRecepcion" DESC;
$function$
;

CREATE OR REPLACE FUNCTION public."VerPalletInventario"(p_idtipopallet integer, p_idestadomateriaprima integer)
 RETURNS TABLE("IdPallet" integer, "CodigoPallet" text, "NumeroRodelas" integer, "Descripcion" text, "FechaRecepcion" date, "NombreProveedor" text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    pa."IdPallet",
    pa."CodigoPallet",
    tp."NumeroRodelas",
    tp."Descripcion",
    lp."FechaRecepcion",
    pro."NombreProveedor"
  FROM "Pallet" AS pa
  INNER JOIN "TipoPallet" AS tp
    ON tp."IdTipoPallet" = pa."IdTipoPallet"
  INNER JOIN "LotePallet" AS lp
    ON lp."IdLotePallet" = pa."IdLotePallet"
  INNER JOIN "Proveedor" AS pro
    ON lp."IdProveedor" = pro."IdProveedor"
  WHERE pa."IdTipoPallet" = p_IdTipoPallet
    AND pa."IdEstadoMateriaPrima" = p_IdEstadoMateriaPrima;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerPausasProduccionBobinaTuboActivas"("FiltroIdTipoBobina" integer DEFAULT NULL::integer)
 RETURNS TABLE("IdPausaProduccionBobinaTubo" integer, "IdProduccionBobinaTubo" integer, "CodigoBobina1" text, "CodigoBobina2" text, "FechaHoraPausa" timestamp with time zone, "NombreEstadoProduccion" text, "CantidadLogsActual" integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ppbt."IdPausaProduccionBobinaTubo",
    ppbt."IdProduccionBobinaTubo",
    bp_1."CodigoBobina",
    bp_2."CodigoBobina",
    ppbt."FechaHoraPausa",
    ep."NombreEstadoProduccion",
    pbt."CantidadLogsActual"
  FROM "PausaProduccionBobinaTubo" AS ppbt
  INNER JOIN "ProduccionBobinaTubo" AS pbt
    ON pbt."IdProduccionBobinaTubo" = ppbt."IdProduccionBobinaTubo"
  INNER JOIN "EstadoProduccion" AS ep
    ON ep."IdEstadoProduccion" = pbt."IdEstadoProduccion"
  INNER JOIN "BobinaPapel" AS bp_1
    ON bp_1."IdBobinaPapel" = pbt."IdBobina_1"
  INNER JOIN "BobinaPapel" AS bp_2
    ON bp_2."IdBobinaPapel" = pbt."IdBobina_2"
  WHERE pbt."IdEstadoProduccion" = 2
    AND ppbt."FechaHoraReanudacion" IS NULL
    AND (
      "FiltroIdTipoBobina" IS NULL
      OR bp_1."IdTipoBobina" = "FiltroIdTipoBobina"
      OR bp_2."IdTipoBobina" = "FiltroIdTipoBobina"
    );
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerPausasProduccionServilletaActivas"()
 RETURNS TABLE("IdPausaProduccionServilleta" integer, "IdProduccionServilleta" integer, "IdSubBobina" integer, "CodigoUnidadOrigen" text, "FechaHoraPausa" timestamp with time zone, "NombreEstadoProduccion" text)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    pps."IdPausaProduccionServilleta",
    pps."IdProduccionServilleta",
    sb."IdSubBobinaServilleta",
    ub."CodigoBobina",
    pps."FechaHoraPausa",
    ep."NombreEstadoProduccion"
  FROM "PausaProduccionServilleta" AS pps
  INNER JOIN "ProduccionServilleta" AS ps
    ON ps."IdProduccionServilleta" = pps."IdProduccionServilleta"
  INNER JOIN "EstadoProduccion" AS ep
    ON ep."IdEstadoProduccion" = ps."IdEstadoProduccion"
  INNER JOIN "SubBobinaServilleta" AS sb
    ON sb."IdSubBobinaServilleta" = ps."IdSubBobina"
  INNER JOIN "UnidadBobinaServilleta" AS ub
    ON ub."IdUnidadBobinaServilleta" = sb."IdUnidadBobinaServilleta"
  WHERE ps."IdEstadoProduccion" = 2
    AND pps."FechaHoraReanudacion" IS NULL;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerProduccionBobinaTubo"(p_idtipobobina integer DEFAULT NULL::integer)
 RETURNS TABLE("IdProduccionBobinaTubo" integer, "IdTipoBobina" integer, "NombreTipoBobina" text, "NombreEstadoProduccion" text, "CodigoBobina1" text, "CodigoBobina2" text, "NombreTurno" text, "FechaInicioProduccion" timestamp with time zone, "CantidadLogsActual" integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoEnProduccion CONSTANT INTEGER := 1;
BEGIN
  RETURN QUERY
  SELECT
    pb."IdProduccionBobinaTubo",
    tb."IdTipoBobina",
    tb."NombreTipoBobina",
    ep."NombreEstadoProduccion",
    b1."CodigoBobina",
    b2."CodigoBobina",
    t."NombreTurno",
    pb."FechaInicioProduccion",
    pb."CantidadLogsActual"
  FROM "ProduccionBobinaTubo" AS pb
  INNER JOIN "EstadoProduccion" AS ep
    ON ep."IdEstadoProduccion" = pb."IdEstadoProduccion"
  INNER JOIN "BobinaPapel" AS b1
    ON b1."IdBobinaPapel" = pb."IdBobina_1"
  INNER JOIN "BobinaPapel" AS b2
    ON b2."IdBobinaPapel" = pb."IdBobina_2"
  INNER JOIN "TipoBobina" AS tb
    ON tb."IdTipoBobina" = b1."IdTipoBobina"
  INNER JOIN "Turno" AS t
    ON t."IdTurno" = pb."IdTurno"
  WHERE pb."IdEstadoProduccion" = c_IdEstadoEnProduccion
    AND (
      p_IdTipoBobina IS NULL
      OR b1."IdTipoBobina" = p_IdTipoBobina
      OR b2."IdTipoBobina" = p_IdTipoBobina
    )
  ORDER BY tb."NombreTipoBobina", pb."FechaInicioProduccion";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerProduccionServilletaActivas"(p_idtipomedidasubbobina integer DEFAULT NULL::integer)
 RETURNS TABLE("IdProduccionServilleta" integer, "NombreEstadoProduccion" text, "IdSubBobina" integer, "CodigoUnidadOrigen" text, "IdTipoMedidaSubBobina" integer, "NombreTurno" text, "FechaInicioProduccion" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    ps."IdProduccionServilleta",
    ep."NombreEstadoProduccion",
    sb."IdSubBobinaServilleta",
    ub."CodigoBobina",
    sb."IdTipoMedidaSubBobina",
    t."NombreTurno",
    ps."FechaInicioProduccion"
  FROM "ProduccionServilleta" AS ps
  INNER JOIN "EstadoProduccion" AS ep
    ON ep."IdEstadoProduccion" = ps."IdEstadoProduccion"
  INNER JOIN "SubBobinaServilleta" AS sb
    ON sb."IdSubBobinaServilleta" = ps."IdSubBobina"
  INNER JOIN "UnidadBobinaServilleta" AS ub
    ON ub."IdUnidadBobinaServilleta" = sb."IdUnidadBobinaServilleta"
  INNER JOIN "Turno" AS t
    ON t."IdTurno" = ps."IdTurno"
  WHERE ps."IdEstadoProduccion" = 1
    AND (p_IdTipoMedidaSubBobina IS NULL OR sb."IdTipoMedidaSubBobina" = p_IdTipoMedidaSubBobina)
  ORDER BY ps."FechaInicioProduccion" DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerProduccionesBobinaTubo"(p_fechainicio date DEFAULT NULL::date, p_fechafin date DEFAULT NULL::date, p_idturno integer DEFAULT NULL::integer, p_idstipobobina integer[] DEFAULT NULL::integer[], p_codigobobina text DEFAULT NULL::text, p_operador text DEFAULT NULL::text, p_idestadoproduccion integer DEFAULT NULL::integer)
 RETURNS TABLE("IdProduccionBobinaTubo" integer, "NombreEstadoProduccion" text, "NombreTurno" text, "Operador" text, "Ci" text, "NombreRol" text, "TipoBobina" text, "CodigoBobina1" text, "CodigoBobina2" text, "FechaInicioProduccion" timestamp with time zone, "FechaFinProduccion" timestamp with time zone, "DuracionTotal" interval, "CantidadLogsActual" integer)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    pbt."IdProduccionBobinaTubo",
    ep."NombreEstadoProduccion",
    t."NombreTurno",
    u."PrimerNombre" || ' ' || u."ApellidoPaterno" AS "Operador",
    u."Ci",
    r."NombreRol",
    tb1."NombreTipoBobina" AS "TipoBobina",
    bp1."CodigoBobina" AS "CodigoBobina1",
    bp2."CodigoBobina" AS "CodigoBobina2",
    pbt."FechaInicioProduccion",
    pbt."FechaFinProduccion",
    pbt."FechaFinProduccion" - pbt."FechaInicioProduccion" AS "DuracionTotal",
    pbt."CantidadLogsActual"
  FROM "ProduccionBobinaTubo" pbt
  JOIN "BobinaPapel" bp1 ON bp1."IdBobinaPapel" = pbt."IdBobina_1"
  JOIN "BobinaPapel" bp2 ON bp2."IdBobinaPapel" = pbt."IdBobina_2"
  JOIN "TipoBobina" tb1 ON tb1."IdTipoBobina" = bp1."IdTipoBobina"
  JOIN "TipoBobina" tb2 ON tb2."IdTipoBobina" = bp2."IdTipoBobina"
  JOIN "Turno" t ON t."IdTurno" = pbt."IdTurno"
  JOIN "EstadoProduccion" ep ON ep."IdEstadoProduccion" = pbt."IdEstadoProduccion"
  JOIN "Usuario" u ON u."IdUsuario" = pbt."IdUsuario"
  JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE
    (
      p_FechaInicio IS NULL
      OR COALESCE(pbt."FechaFinProduccion", pbt."FechaInicioProduccion") >= p_FechaInicio
    )
    AND (
      p_FechaFin IS NULL
      OR COALESCE(pbt."FechaFinProduccion", pbt."FechaInicioProduccion") < (p_FechaFin + 1)
    )
    AND (p_IdTurno IS NULL OR pbt."IdTurno" = p_IdTurno)
    AND (
      p_IdsTipoBobina IS NULL
      OR tb1."IdTipoBobina" = ANY(p_IdsTipoBobina)
      OR tb2."IdTipoBobina" = ANY(p_IdsTipoBobina)
    )
    AND (
      p_CodigoBobina IS NULL
      OR bp1."CodigoBobina" = p_CodigoBobina
      OR bp2."CodigoBobina" = p_CodigoBobina
    )
    AND (
      p_Operador IS NULL
      OR u."Ci" = p_Operador
      OR (u."PrimerNombre" || ' ' || u."ApellidoPaterno") ILIKE '%' || p_Operador || '%'
    )
    AND (p_IdEstadoProduccion IS NULL OR pbt."IdEstadoProduccion" = p_IdEstadoProduccion)
  ORDER BY COALESCE(pbt."FechaFinProduccion", pbt."FechaInicioProduccion") DESC;
$function$
;

CREATE OR REPLACE FUNCTION public."VerProduccionesServilleta"(p_fechainicio date DEFAULT NULL::date, p_fechafin date DEFAULT NULL::date, p_idturno integer DEFAULT NULL::integer, p_idstipobobinaservilleta integer[] DEFAULT NULL::integer[], p_codigobobina text DEFAULT NULL::text, p_operador text DEFAULT NULL::text, p_idestadoproduccion integer DEFAULT NULL::integer)
 RETURNS TABLE("IdProduccionServilleta" integer, "NombreEstadoProduccion" text, "NombreTurno" text, "Operador" text, "Ci" text, "NombreRol" text, "NombreTipoBobinaServilleta" text, "CodigoBobina" text, "DescripcionMedida" text, "IdSubBobinaServilleta" integer, "FechaInicioProduccion" timestamp with time zone, "FechaFinProduccion" timestamp with time zone, "DuracionTotal" interval)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    ps."IdProduccionServilleta",
    ep."NombreEstadoProduccion",
    t."NombreTurno",
    u."PrimerNombre" || ' ' || u."ApellidoPaterno" AS "Operador",
    u."Ci",
    r."NombreRol",
    tbs."NombreTipoBobinaServilleta",
    ubs."CodigoBobina",
    tms."Descripcion" AS "DescripcionMedida",
    sbs."IdSubBobinaServilleta",
    ps."FechaInicioProduccion",
    ps."FechaFinProduccion",
    ps."FechaFinProduccion" - ps."FechaInicioProduccion" AS "DuracionTotal"
  FROM "ProduccionServilleta" ps
  JOIN "EstadoProduccion" ep ON ep."IdEstadoProduccion" = ps."IdEstadoProduccion"
  JOIN "Turno" t ON t."IdTurno" = ps."IdTurno"
  JOIN "SubBobinaServilleta" sbs ON sbs."IdSubBobinaServilleta" = ps."IdSubBobina"
  JOIN "TipoMedidaSubBobina" tms ON tms."IdTipoMedidaSubBobina" = sbs."IdTipoMedidaSubBobina"
  JOIN "UnidadBobinaServilleta" ubs ON ubs."IdUnidadBobinaServilleta" = sbs."IdUnidadBobinaServilleta"
  JOIN "BobinaServilleta" bs ON bs."IdBobinaServilleta" = ubs."IdBobinaServilleta"
  JOIN "TipoBobinaServilleta" tbs ON tbs."IdTipoBobinaServilleta" = bs."IdTipoBobinaServilleta"
  JOIN "Usuario" u ON u."IdUsuario" = ps."IdUsuario"
  JOIN "Rol" r ON r."IdRol" = u."IdRol"
  WHERE
    (
      p_FechaInicio IS NULL
      OR COALESCE(ps."FechaFinProduccion", ps."FechaInicioProduccion") >= p_FechaInicio
    )
    AND (
      p_FechaFin IS NULL
      OR COALESCE(ps."FechaFinProduccion", ps."FechaInicioProduccion") < (p_FechaFin + 1)
    )
    AND (p_IdTurno IS NULL OR ps."IdTurno" = p_IdTurno)
    AND (p_IdsTipoBobinaServilleta IS NULL OR bs."IdTipoBobinaServilleta" = ANY(p_IdsTipoBobinaServilleta))
    AND (p_CodigoBobina IS NULL OR ubs."CodigoBobina" = p_CodigoBobina)
    AND (
      p_Operador IS NULL
      OR u."Ci" = p_Operador
      OR (u."PrimerNombre" || ' ' || u."ApellidoPaterno") ILIKE '%' || p_Operador || '%'
    )
    AND (p_IdEstadoProduccion IS NULL OR ps."IdEstadoProduccion" = p_IdEstadoProduccion)
  ORDER BY COALESCE(ps."FechaFinProduccion", ps."FechaInicioProduccion") DESC;
$function$
;

CREATE OR REPLACE FUNCTION public."VerResumenInventarioBobinaPapel"()
 RETURNS TABLE("IdTipoBobina" integer, "NombreTipoBobina" text, "CantidadBobinas" bigint, "PesoNetoTotalKg" numeric, "GramajePromedio" numeric)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    tb."IdTipoBobina",
    tb."NombreTipoBobina",
    COUNT(bp."IdBobinaPapel") AS "CantidadBobinas",
    COALESCE(SUM(bp."PesoNetoKg"), 0) AS "PesoNetoTotalKg",
    COALESCE(AVG(bp."Gramaje"), 0) AS "GramajePromedio"
  FROM "TipoBobina" AS tb
  LEFT JOIN "BobinaPapel" AS bp
    ON bp."IdTipoBobina" = tb."IdTipoBobina"
    AND bp."IdEstadoMateriaPrima" = 1
  GROUP BY tb."IdTipoBobina", tb."NombreTipoBobina"
  ORDER BY tb."IdTipoBobina";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerResumenInventarioBobinaServilleta"()
 RETURNS TABLE("IdTipoBobinaServilleta" integer, "NombreTipoBobinaServilleta" text, "CantidadBobinaServilleta" bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoAlmacen CONSTANT INTEGER := 1;
BEGIN
  RETURN QUERY
  SELECT
    tbs."IdTipoBobinaServilleta",
    tbs."NombreTipoBobinaServilleta",
    COUNT(bs."IdBobinaServilleta") AS "CantidadBobinaServilleta"
  FROM "TipoBobinaServilleta" AS tbs
  LEFT JOIN "BobinaServilleta" AS bs
    ON bs."IdTipoBobinaServilleta" = tbs."IdTipoBobinaServilleta"
    AND bs."IdEstadoMateriaPrima" = c_IdEstadoAlmacen
  GROUP BY
    tbs."IdTipoBobinaServilleta", tbs."NombreTipoBobinaServilleta"
  ORDER BY tbs."IdTipoBobinaServilleta";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerResumenInventarioEmpaque"()
 RETURNS TABLE("IdTipoEmpaque" integer, "NombreTipoEmpaque" text, "CantidadEmpaques" bigint)
 LANGUAGE plpgsql
AS $function$
BEGIN
  RETURN QUERY
  SELECT
    te."IdTipoEmpaque",
    te."NombreTipoEmpaque",
    COUNT(emp."IdEmpaque") AS "CantidadEmpaques"
  FROM "TipoEmpaque" AS te
  LEFT JOIN "Empaque" AS emp
    ON emp."IdTipoEmpaque" = te."IdTipoEmpaque"
    AND emp."IdEstadoMateriaPrima" = 1 -- En almacén
  GROUP BY te."IdTipoEmpaque", te."NombreTipoEmpaque"
  ORDER BY te."IdTipoEmpaque";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerResumenInventarioRodela"()
 RETURNS TABLE("IdTipoRodela" integer, "NombreTipoRodela" text, "Descripcion" text, "CantidadEnAlmacen" bigint, "CantidadAbiertas" bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoAlmacen CONSTANT INTEGER := 1;
  c_IdEstadoAbierta CONSTANT INTEGER := 6;
BEGIN
  RETURN QUERY
  SELECT
    tr."IdTipoRodela",
    tr."NombreTipoRodela",
    tr."Descripcion",
    COUNT(r."IdRodela") FILTER (WHERE r."IdEstadoMateriaPrima" = c_IdEstadoAlmacen) AS "CantidadEnAlmacen",
    COUNT(r."IdRodela") FILTER (WHERE r."IdEstadoMateriaPrima" = c_IdEstadoAbierta) AS "CantidadAbiertas"
  FROM "TipoRodela" AS tr
  LEFT JOIN "Rodela" AS r
    ON r."IdTipoRodela" = tr."IdTipoRodela"
   AND r."IdEstadoMateriaPrima" IN (c_IdEstadoAlmacen, c_IdEstadoAbierta)
  GROUP BY tr."IdTipoRodela", tr."NombreTipoRodela", tr."Descripcion"
  ORDER BY tr."IdTipoRodela";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerResumenInventarioSubBobinaServilleta"()
 RETURNS TABLE("IdTipoMedidaSubBobina" integer, "NombreTipoMedida" text, "CantidadSubBobinas" bigint)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoAlmacen CONSTANT INTEGER := 1;
BEGIN
  RETURN QUERY
  SELECT
    tm."IdTipoMedidaSubBobina",
    tm."Descripcion",
    COUNT(sb."IdSubBobinaServilleta") AS "CantidadSubBobinas"
  FROM "TipoMedidaSubBobina" AS tm
  LEFT JOIN "SubBobinaServilleta" AS sb
    ON sb."IdTipoMedidaSubBobina" = tm."IdTipoMedidaSubBobina"
    AND sb."IdEstadoMateriaPrima" = c_IdEstadoAlmacen
  GROUP BY
    tm."IdTipoMedidaSubBobina", tm."Descripcion"
  ORDER BY tm."IdTipoMedidaSubBobina";
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerRodelas"(p_codigorodela text DEFAULT NULL::text, p_idproveedor integer DEFAULT NULL::integer, p_idstiporodela integer[] DEFAULT NULL::integer[], p_idestadomateriaprima integer DEFAULT NULL::integer, p_idrodela integer DEFAULT NULL::integer, p_idloterodela integer DEFAULT NULL::integer)
 RETURNS TABLE("IdRodela" integer, "CodigoRodela" text, "TipoEstado" text, "NombreTipoRodela" text, "NombreProveedor" text, "FechaRecepcion" date, "IdLoteRodela" integer)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    r."IdRodela",
    r."CodigoRodela",
    emp."TipoEstado",
    tr."NombreTipoRodela",
    p."NombreProveedor",
    lr."FechaRecepcion",
    lr."IdLoteRodela"
  FROM "Rodela" r
  JOIN "EstadoMateriaPrima" emp ON r."IdEstadoMateriaPrima" = emp."IdEstadoMateriaPrima"
  JOIN "TipoRodela" tr ON r."IdTipoRodela" = tr."IdTipoRodela"
  JOIN "LoteRodela" lr ON r."IdLoteRodela" = lr."IdLoteRodela"
  JOIN "Proveedor" p ON lr."IdProveedor" = p."IdProveedor"
  WHERE
    (p_CodigoRodela IS NULL OR r."CodigoRodela" = p_CodigoRodela)
    AND (p_IdProveedor IS NULL OR lr."IdProveedor" = p_IdProveedor)
    AND (p_IdsTipoRodela IS NULL OR r."IdTipoRodela" = ANY(p_IdsTipoRodela))
    AND (p_IdEstadoMateriaPrima IS NULL OR r."IdEstadoMateriaPrima" = p_IdEstadoMateriaPrima)
    AND (p_IdRodela IS NULL OR r."IdRodela" = p_IdRodela)
    AND (p_IdLoteRodela IS NULL OR r."IdLoteRodela" = p_IdLoteRodela)
  ORDER BY lr."FechaRecepcion" DESC, r."CodigoRodela";
$function$
;

CREATE OR REPLACE FUNCTION public."VerSubBobinasServilleta"(p_codigobobina text DEFAULT NULL::text, p_idproveedor integer DEFAULT NULL::integer, p_idtipobobinaservilleta integer DEFAULT NULL::integer, p_idstipomedidasubbobina integer[] DEFAULT NULL::integer[], p_idestadomateriaprima integer DEFAULT NULL::integer, p_idbobinaservilleta integer DEFAULT NULL::integer, p_idsubbobinaservilleta integer DEFAULT NULL::integer)
 RETURNS TABLE("IdSubBobinaServilleta" integer, "TipoEstado" text, "IdTipoMedidaSubBobina" integer, "DescripcionMedida" text, "CantidadPorMedida" bigint, "CodigoBobina" text, "IdBobinaServilleta" integer, "NombreTipoBobinaServilleta" text, "CodigoLote" text, "FechaRecepcion" date, "NombreProveedor" text)
 LANGUAGE sql
 STABLE
AS $function$
  SELECT
    sbs."IdSubBobinaServilleta",
    emp."TipoEstado",
    tms."IdTipoMedidaSubBobina",
    tms."Descripcion" AS "DescripcionMedida",
    COUNT(*) OVER (PARTITION BY tms."IdTipoMedidaSubBobina") AS "CantidadPorMedida",
    ubs."CodigoBobina",
    bs."IdBobinaServilleta",
    tbs."NombreTipoBobinaServilleta",
    lbs."IdLoteBobinaServilleta"::text AS "CodigoLote",
    lbs."FechaRecepcion",
    p."NombreProveedor"
  FROM "SubBobinaServilleta" sbs
  JOIN "UnidadBobinaServilleta" ubs ON ubs."IdUnidadBobinaServilleta" = sbs."IdUnidadBobinaServilleta"
  JOIN "EstadoMateriaPrima" emp ON emp."IdEstadoMateriaPrima" = sbs."IdEstadoMateriaPrima"
  JOIN "TipoMedidaSubBobina" tms ON tms."IdTipoMedidaSubBobina" = sbs."IdTipoMedidaSubBobina"
  JOIN "BobinaServilleta" bs ON bs."IdBobinaServilleta" = ubs."IdBobinaServilleta"
  JOIN "TipoBobinaServilleta" tbs ON tbs."IdTipoBobinaServilleta" = bs."IdTipoBobinaServilleta"
  JOIN "LoteBobinaServilleta" lbs ON lbs."IdLoteBobinaServilleta" = bs."IdLoteBobinaServilleta"
  JOIN "Proveedor" p ON p."IdProveedor" = lbs."IdProveedor"
  WHERE
    (p_CodigoBobina IS NULL OR ubs."CodigoBobina" = p_CodigoBobina)
    AND (p_IdProveedor IS NULL OR lbs."IdProveedor" = p_IdProveedor)
    AND (p_IdTipoBobinaServilleta IS NULL OR bs."IdTipoBobinaServilleta" = p_IdTipoBobinaServilleta)
    AND (p_IdsTipoMedidaSubBobina IS NULL OR sbs."IdTipoMedidaSubBobina" = ANY(p_IdsTipoMedidaSubBobina))
    AND (p_IdEstadoMateriaPrima IS NULL OR sbs."IdEstadoMateriaPrima" = p_IdEstadoMateriaPrima)
    AND (p_IdBobinaServilleta IS NULL OR bs."IdBobinaServilleta" = p_IdBobinaServilleta)
    AND (p_IdSubBobinaServilleta IS NULL OR sbs."IdSubBobinaServilleta" = p_IdSubBobinaServilleta)
  ORDER BY tms."Descripcion", ubs."CodigoBobina", sbs."IdSubBobinaServilleta";
$function$
;

CREATE OR REPLACE FUNCTION public."VerSubBobinasServilletaFueraInventario"()
 RETURNS TABLE("IdSubBobinaServilleta" integer, "CodigoUnidadOrigen" text, "NombreTipoMedida" text, "UltimaObservacion" text, "FechaUltimoMovimiento" timestamp with time zone)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoFueraInventario CONSTANT INTEGER := 5;
BEGIN
  RETURN QUERY
  SELECT
    sb."IdSubBobinaServilleta",
    ub."CodigoBobina",
    tm."Descripcion",
    um."Observacion",
    um."FechaMovimiento"
  FROM "SubBobinaServilleta" AS sb
  INNER JOIN "UnidadBobinaServilleta" AS ub
    ON ub."IdUnidadBobinaServilleta" = sb."IdUnidadBobinaServilleta"
  INNER JOIN "TipoMedidaSubBobina" AS tm
    ON tm."IdTipoMedidaSubBobina" = sb."IdTipoMedidaSubBobina"
  LEFT JOIN LATERAL (
    SELECT msb."Observacion", msb."FechaMovimiento"
    FROM "MovimientoSubBobina" AS msb
    WHERE msb."IdSubBobinaServilleta" = sb."IdSubBobinaServilleta"
    ORDER BY msb."FechaMovimiento" DESC
    LIMIT 1
  ) AS um ON true
  WHERE sb."IdEstadoMateriaPrima" = c_IdEstadoFueraInventario
  ORDER BY um."FechaMovimiento" DESC;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerificacionUsuario"(p_ci text)
 RETURNS TABLE("IdUsuario" integer, "Clave" text, "IdRol" integer, "NombreRol" text, "IdEstadoUsuario" integer, "NombreEstadoUsuario" text, "PrimerNombre" text, "SegundoNombre" text, "ApellidoPaterno" text, "ApellidoMaterno" text)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT
        u."IdUsuario",
        u."Clave",
        u."IdRol",
        r."NombreRol",
        u."IdEstadoUsuario",
        eu."NombreEstadoUsuario",
        u."PrimerNombre",
        u."SegundoNombre",
        u."ApellidoPaterno",
        u."ApellidoMaterno"
    FROM "Usuario" u
    JOIN "Rol" r ON r."IdRol" = u."IdRol"
    JOIN "EstadoUsuario" eu ON eu."IdEstadoUsuario" = u."IdEstadoUsuario"
    WHERE u."Ci" = p_ci;
END;
$function$
;

CREATE OR REPLACE FUNCTION public."VerificarAdmin"(p_idusuario integer)
 RETURNS TABLE("EsAdminOut" boolean, "IdEstadoUsuarioOut" integer)
 LANGUAGE plpgsql
 STABLE
AS $function$
BEGIN
    RETURN QUERY
    SELECT u."IsAdmin", u."IdEstadoUsuario"
      FROM public."Usuario" u
     WHERE u."IdUsuario" = p_IdUsuario;
END;
$function$
;

CREATE OR REPLACE FUNCTION public.custom_access_token_hook(event jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
AS $function$
DECLARE
    v_claims      JSONB;
    v_extra       JSONB;
    v_id_usuario  INTEGER;
    v_id_rol      INTEGER;
    v_id_estado   INTEGER;
    v_is_admin    BOOLEAN;
BEGIN
    SELECT u."IdUsuario", u."IdRol", u."IdEstadoUsuario", u."IsAdmin"
      INTO v_id_usuario, v_id_rol, v_id_estado, v_is_admin
      FROM public."Usuario" u
     WHERE u."AuthUserId" = (event ->> 'user_id')::UUID;

    v_claims := event -> 'claims';

    v_extra := jsonb_build_object('IdEstadoUsuario', v_id_estado);

    IF v_id_usuario IS NOT NULL AND v_id_estado = 1 THEN
        v_extra := v_extra || jsonb_build_object(
            'IdUsuario', v_id_usuario,
            'IdRol',     v_id_rol,
            'IsAdmin',   COALESCE(v_is_admin, false)
        );
    END IF;

    v_claims := jsonb_set(
        v_claims,
        '{app_metadata}',
        COALESCE(v_claims -> 'app_metadata', '{}'::JSONB) || v_extra
    );

    RETURN jsonb_set(event, '{claims}', v_claims);
END;
$function$
;


CREATE OR REPLACE FUNCTION public."IniciarProduccionBobinaTubo"(p_idbobina1 integer, p_idbobina2 integer, p_idusuario integer, p_idproducto integer DEFAULT NULL::integer)
 RETURNS TABLE("IdProduccionBobinaTubo" integer, "FechaInicioProduccion" timestamp with time zone, "IdTurno" integer, "NombreTurno" text, "IdProducto" integer, "NombreProducto" text)
 LANGUAGE plpgsql
AS $function$
DECLARE
  c_IdEstadoProduccion     CONSTANT INTEGER := 1;
  c_IdEstadoAlmacen        CONSTANT INTEGER := 1;
  c_IdEstadoEnProdMP       CONSTANT INTEGER := 2;
  c_IdTipoMovimiento       CONSTANT INTEGER := 2;
  c_IdTipoHigienico        CONSTANT INTEGER := 1;
  c_IdTipoToalla           CONSTANT INTEGER := 2;
  c_IdTipoEconomico        CONSTANT INTEGER := 3;
  c_IdProductoToalla       CONSTANT INTEGER := 7;
  c_IdProductoEconomico    CONSTANT INTEGER := 5;
  c_ProductosHigienico     CONSTANT INTEGER[] := ARRAY[1, 2, 4];
  v_EstadoBobina1          INTEGER;
  v_EstadoBobina2          INTEGER;
  v_TipoBobina1            INTEGER;
  v_TipoBobina2            INTEGER;
  v_IdProducto             INTEGER;
  v_HoraLocal              TIME;
  v_IdTurno                INTEGER;
  v_IdProduccionBobinaTubo INTEGER;
  v_FechaInicioProduccion  TIMESTAMPTZ;
BEGIN
  IF p_IdBobina1 IS NULL THEN
    RAISE EXCEPTION 'IdBobina1 es obligatorio para iniciar producción de Bobina Tubo.';
  END IF;

  IF p_IdBobina2 IS NULL THEN
    RAISE EXCEPTION 'IdBobina2 es obligatorio para iniciar producción de Bobina Tubo.';
  END IF;

  IF p_IdBobina1 = p_IdBobina2 THEN
    RAISE EXCEPTION 'IdBobina1 e IdBobina2 no pueden ser la misma bobina.';
  END IF;

  SELECT bp."IdEstadoMateriaPrima", bp."IdTipoBobina"
  INTO v_EstadoBobina1, v_TipoBobina1
  FROM "BobinaPapel" AS bp
  WHERE bp."IdBobinaPapel" = p_IdBobina1
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la bobina con IdBobinaPapel = %', p_IdBobina1;
  END IF;

  SELECT bp."IdEstadoMateriaPrima", bp."IdTipoBobina"
  INTO v_EstadoBobina2, v_TipoBobina2
  FROM "BobinaPapel" AS bp
  WHERE bp."IdBobinaPapel" = p_IdBobina2
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la bobina con IdBobinaPapel = %', p_IdBobina2;
  END IF;

  IF v_EstadoBobina1 <> c_IdEstadoAlmacen THEN
    RAISE EXCEPTION 'La bobina % no está En almacén (estado actual: %), no puede ingresar a producción', p_IdBobina1, v_EstadoBobina1;
  END IF;

  IF v_EstadoBobina2 <> c_IdEstadoAlmacen THEN
    RAISE EXCEPTION 'La bobina % no está En almacén (estado actual: %), no puede ingresar a producción', p_IdBobina2, v_EstadoBobina2;
  END IF;

  IF v_TipoBobina1 <> v_TipoBobina2 THEN
    RAISE EXCEPTION 'Las bobinas deben ser del mismo tipo para iniciar la producción.';
  END IF;

  IF v_TipoBobina1 = c_IdTipoHigienico THEN
    IF p_IdProducto IS NULL THEN
      RAISE EXCEPTION 'Debe seleccionar el producto para la producción de bobinas de papel higiénico.';
    END IF;
    IF NOT (p_IdProducto = ANY(c_ProductosHigienico)) THEN
      RAISE EXCEPTION 'El producto % no es válido para bobinas de papel higiénico.', p_IdProducto;
    END IF;
    v_IdProducto := p_IdProducto;
  ELSIF v_TipoBobina1 = c_IdTipoToalla THEN
    v_IdProducto := c_IdProductoToalla;
  ELSIF v_TipoBobina1 = c_IdTipoEconomico THEN
    v_IdProducto := c_IdProductoEconomico;
  ELSE
    RAISE EXCEPTION 'El tipo de bobina % no tiene un producto asociado.', v_TipoBobina1;
  END IF;

  IF p_IdProducto IS NOT NULL AND p_IdProducto <> v_IdProducto THEN
    RAISE EXCEPTION 'El producto % no es válido para este tipo de bobina.', p_IdProducto;
  END IF;

  v_HoraLocal := (now() AT TIME ZONE 'America/La_Paz')::TIME;

  SELECT t."IdTurno" INTO v_IdTurno
  FROM "Turno" AS t
  WHERE
    (t."HoraInicio" <= t."HoraFin" AND v_HoraLocal BETWEEN t."HoraInicio" AND t."HoraFin")
    OR
    (t."HoraInicio" > t."HoraFin" AND (v_HoraLocal >= t."HoraInicio" OR v_HoraLocal <= t."HoraFin"))
  LIMIT 1;

  INSERT INTO "ProduccionBobinaTubo" AS pbt (
    "IdEstadoProduccion",
    "IdUsuario",
    "IdBobina_1",
    "IdBobina_2",
    "IdTurno",
    "IdProducto",
    "FechaInicioProduccion",
    "FechaFinProduccion"
  ) VALUES (
    c_IdEstadoProduccion,
    p_IdUsuario,
    p_IdBobina1,
    p_IdBobina2,
    v_IdTurno,
    v_IdProducto,
    now(),
    NULL
  )
  RETURNING pbt."IdProduccionBobinaTubo", pbt."FechaInicioProduccion"
  INTO v_IdProduccionBobinaTubo, v_FechaInicioProduccion;

  UPDATE "BobinaPapel" AS bp
  SET "IdEstadoMateriaPrima" = c_IdEstadoEnProdMP
  WHERE bp."IdBobinaPapel" IN (p_IdBobina1, p_IdBobina2);

  INSERT INTO "MovimientoBobina" ("IdBobinaPapel", "IdTipoMovimiento", "IdUsuario", "Observacion")
  SELECT b."IdBobinaPapel", c_IdTipoMovimiento, p_IdUsuario, 'Traslado a producción - Producción Bobina Tubo #' || v_IdProduccionBobinaTubo
  FROM "BobinaPapel" AS b
  WHERE b."IdBobinaPapel" IN (p_IdBobina1, p_IdBobina2);

  RETURN QUERY
  SELECT
    v_IdProduccionBobinaTubo,
    v_FechaInicioProduccion,
    v_IdTurno,
    t."NombreTurno",
    p."IdProducto",
    p."NombreProducto"
  FROM "Turno" AS t
  CROSS JOIN "Producto" AS p
  WHERE t."IdTurno" = v_IdTurno
    AND p."IdProducto" = v_IdProducto;
END;
$function$
