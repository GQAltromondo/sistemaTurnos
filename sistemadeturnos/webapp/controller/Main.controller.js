// Cargar la librería XLSX
jQuery.sap.require("transener.sistemadeturnos.libs.xlsx");
jQuery.sap.require("transener.sistemadeturnos.libs.jszip");
sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/library",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/Fragment",
    "sap/ui/export/Spreadsheet",
    "transener/sistemadeturnos/utils/ModelHelper",
    "transener/sistemadeturnos/utils/FormatHelper",
    "transener/sistemadeturnos/utils/Utils",
    "transener/sistemadeturnos/services/LicenseService",
    "transener/sistemadeturnos/services/TurnosService",
    "transener/sistemadeturnos/services/TipoEquipoService",
    "transener/sistemadeturnos/services/InterventionTypesService",
    "transener/sistemadeturnos/model/HardCodeModel",
    "transener/sistemadeturnos/utils/TreeTableHelper",
    "transener/sistemadeturnos/services/TramitacionService",
    "transener/sistemadeturnos/utils/RoleHelper",
    "transener/sistemadeturnos/utils/AppManagementHelper",
    "transener/sistemadeturnos/services/UserService"


], function (Controller, MessageToast, MessageBox, CoreLibrary, Filter, FilterOperator, JSONModel, Fragment, Spreadsheet,
    //utils
    ModelHelper, FormatHelper, Utils,
    //services
    LicenseService, TurnosService, TipoEquipoService, InterventionTypesService, HardCodeModel, TreeTableHelper, TramitacionService, RoleHelper, AppManagementHelper, UserService
) {
    "use strict";
    let oDialog = null
    return Controller.extend("transener.sistemadeturnos.controller.Main", {
        formatter: FormatHelper,

        onInit: function () {

            this.getBaseURL();
            UserService.loadModel(this.onUserLoaded.bind(this));

            this._pBusyDialog = null;
            this.getVersion();
            this.cargarModelos()
            this._suppressLicenseAlert = false;

            this._initAccionesEntregaModel();

            const oTreeModel = new JSONModel([]);
            this.getView().setModel(oTreeModel, "listCronoTreeModel");

            var oViewModel = new JSONModel({
                busy: false,
                delay: 0
            });
            this.getView().setModel(oViewModel, "viewModel");

            const oReporteModel = new JSONModel([]);
            this.getView().setModel(oReporteModel, "ReporteModel");

            // Cargar catálogo después de que el modelo OData esté listo
            const oModel = this.getOwnerComponent().getModel();
            if (oModel) {
                oModel.metadataLoaded().then(() => {
                    this._cargarCatalogoCodigosDesdeBackend();
                });
            }
        },

        getBaseURL: function () {
            var appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");

            // Guardar el appId en un modelo por si se necesita
            var appModel = new JSONModel();
            appModel.setData(appId);
            sap.ui.getCore().setModel(appModel, "appId");

            // Construir el path del módulo
            var appPath = appId.replaceAll(".", "/");
            var appModulePath = jQuery.sap.getModulePath(appPath);

            // Crear o actualizar el modelo appCurrentInfo
            var jsonModel = sap.ui.getCore().getModel("appCurrentInfo");
            if (!jsonModel) {
                jsonModel = new JSONModel();
                jsonModel.setSizeLimit(9999);
                sap.ui.getCore().setModel(jsonModel, "appCurrentInfo");
            }

            // Setear la URL en el modelo
            jsonModel.setData({
                appUrl: appModulePath
            });

            console.log("URL base de la aplicación configurada:", appModulePath);

            return appModulePath;
        },

        onUserLoaded: function () {
            console.log("Usuario cargado");

            // aplicar permisos basados en roles
            this._aplicarPermisosPorRol();
        },

        // Aplica permisos de visualización/edición según el rol del usuario

        _aplicarPermisosPorRol: function () {
            var bEsEditor = RoleHelper.isEditor();

            console.log("Aplicando permisos. Es editor?", bEsEditor);

            // Botón Crear Solicitud
            var btnCrear = this.byId("btnCrearSolicitud");
            if (btnCrear) {
                btnCrear.setVisible(bEsEditor);
                btnCrear.setEnabled(bEsEditor);
            }

            // Botón Guardar
            var btnGuardar = this.byId("btnGuardar");
            if (btnGuardar) {
                btnGuardar.setVisible(bEsEditor);
                btnGuardar.setEnabled(bEsEditor);
            }

            // Botón Enviar
            var btnEnviar = this.byId("btnEnviar");
            if (btnEnviar) {
                btnEnviar.setVisible(bEsEditor);
                btnEnviar.setEnabled(bEsEditor);
            }

            // Botón Editar
            var btnEditar = this.byId("btnEditar");
            if (btnEditar) {
                btnEditar.setVisible(bEsEditor);
                btnEditar.setEnabled(bEsEditor);
            }

            // Botón Eliminar
            var btnEliminar = this.byId("btnEliminar");
            if (btnEliminar) {
                btnEliminar.setVisible(bEsEditor);
                btnEliminar.setEnabled(bEsEditor);
            }

            // === COLUMNAS DE LA TABLA ===
            // Columna Comentarios
            var colComentarios = this.byId("colComentarios");
            if (colComentarios) {
                colComentarios.setVisible(bEsEditor);
            }

            // Columna Adjuntar
            var colAdjuntar = this.byId("colAdjuntar");
            if (colAdjuntar) {
                colAdjuntar.setVisible(bEsEditor);
            }

            // Columna Horario Turno
            var colHorarioTurno = this.byId("colHorarioTurno");
            if (colHorarioTurno) {
                colHorarioTurno.setVisible(bEsEditor);
            }

            // Columna Agregar Licencias (botón +)
            var colAgregarLicencias = this.byId("colAgregarLic");
            if (colAgregarLicencias) {
                colAgregarLicencias.setVisible(bEsEditor);
            }

            // === CAMPOS DE INPUTS
            // Input Instalación
            var inputInstalacion = this.byId("inputInstalacion");
            if (inputInstalacion) {
                inputInstalacion.setEditable(bEsEditor);
            }

            // Input Equipo
            var inputEquipo = this.byId("inputEquipo");
            if (inputEquipo) {
                inputEquipo.setEditable(bEsEditor);
            }

            // Input Trabajos a Realizar
            var inputTrabajos = this.byId("inputTrabajos");
            if (inputTrabajos) {
                inputTrabajos.setEditable(bEsEditor);
            }

            // DateTimePicker Inicio Programado
            var dtpInicioProg = this.byId("dtpInicioProgramado");
            if (dtpInicioProg) {
                dtpInicioProg.setEditable(bEsEditor);
            }

            // DateTimePicker Fin Programado
            var dtpFinProg = this.byId("dtpFinProgramado");
            if (dtpFinProg) {
                dtpFinProg.setEditable(bEsEditor);
            }

            // Select Empresa
            var selectEmpresa = this.byId("selectEmpresa");
            if (selectEmpresa) {
                selectEmpresa.setEnabled(bEsEditor);
            }

            // Select Categoría Licencia
            var selectCategoria = this.byId("selectCategoriaLicencia");
            if (selectCategoria) {
                selectCategoria.setEnabled(bEsEditor);
            }

            // Select Área Solicitante
            var selectAreaSolic = this.byId("selectAreaSolicitante");
            if (selectAreaSolic) {
                selectAreaSolic.setEnabled(bEsEditor);
            }

            // Checkbox Requiere PAT
            var chkPAT = this.byId("chkRequierePAT");
            if (chkPAT) {
                chkPAT.setEnabled(bEsEditor);
            }
        },
        // ----------------------------------- TURNOS EDITABLES ----------------------------------------
        _updateEditableState: function () {
            const oView = this.getView();
            const oDatePicker = this.byId("date");
            const oFechaTurno = oDatePicker && oDatePicker.getDateValue();
            const bIsEditable = this._isEditableTurno(oFechaTurno);

            // Crear o actualizar modelo de habilitación para la UI
            let oEditableModel = oView.getModel("editableModel");
            if (!oEditableModel) {
                oEditableModel = new JSONModel({ isEditable: bIsEditable });
                oView.setModel(oEditableModel, "editableModel");
            } else {
                oEditableModel.setProperty("/isEditable", bIsEditable);
            }
        },
        //---------------------------------------------------------------------------------------------
        // ------------------------------------ Acciones para la entrega ------------------------------------------------------
        _initAccionesEntregaModel: function () {
            const oView = this.getView();

            // Crear modelo para almacenar las acciones seleccionadas
            const oAccionesModel = new JSONModel([]);
            oView.setModel(oAccionesModel, "AccionesEntregaModel");
        },

        _initAccionesEntregaModel: function () {
            const oView = this.getView();

            // Crear modelo para almacenar las acciones seleccionadas
            const oAccionesModel = new JSONModel([]);
            oView.setModel(oAccionesModel, "AccionesEntregaModel");
        },

        onOpenAccionEntregaPopover: function (oEvent) {
            const oView = this.getView();
            const oTable = this.byId("turnosTable");

            let oBindingContext = null;

            // Intento 1: Desde el source (MenuItem)
            oBindingContext = oEvent.getSource().getBindingContext("LicencesJsonModel");

            // Intento 2: Desde el parent (Context Menu)
            if (!oBindingContext) {
                const oMenuItem = oEvent.getSource();
                const oContextMenu = oMenuItem.getParent();

                if (oContextMenu) {
                    oBindingContext = oContextMenu.getBindingContext("LicencesJsonModel");
                }
            }

            // Intento 3: Desde el path del context menu (como onDeletePress)
            if (!oBindingContext) {
                const oMenuItem = oEvent.getSource();
                const oContextMenu = oMenuItem.getParent();

                if (oContextMenu && oContextMenu.getBindingContext("LicencesJsonModel")) {
                    const sPath = oContextMenu.getBindingContext("LicencesJsonModel").getPath();
                    const iIndex = parseInt(sPath.split("/").pop());

                    if (!isNaN(iIndex)) {
                        oBindingContext = oTable.getContextByIndex(iIndex);
                    }
                }
            }

            // Intento 4: Fallback a índice seleccionado
            if (!oBindingContext) {
                const iSelectedIndex = oTable.getSelectedIndex();
                if (iSelectedIndex >= 0) {
                    oBindingContext = oTable.getContextByIndex(iSelectedIndex);
                }
            }

            if (!oBindingContext) {
                MessageToast.show("No se pudo obtener el contexto de la fila. Por favor, seleccione una fila.");
                return;
            }

            const oLicencia = oBindingContext.getObject();

            // Guardar referencia
            this._currentLicenciaEntrega = oLicencia;
            this._currentBindingContextEntrega = oBindingContext;

            // Destruir popover anterior si existe
            if (this._oAccionEntregaPopover) {
                this._oAccionEntregaPopover.destroy();
                this._oAccionEntregaPopover = null;
            }

            // Cargar fragment
            Fragment.load({
                id: oView.getId(),
                name: "transener.sistemadeturnos.fragments.ComboPopover",
                controller: this
            }).then(function (oPopover) {
                this._oAccionEntregaPopover = oPopover;
                oView.addDependent(oPopover);

                // Inicializar checkboxes según acciones ya seleccionadas
                this._initializeCheckBoxesEntrega();

                // Buscar la fila visual que corresponde al binding context
                const aRows = oTable.getRows();
                let oTargetRow = null;

                for (let i = 0; i < aRows.length; i++) {
                    const oRowContext = aRows[i].getBindingContext("LicencesJsonModel");
                    if (oRowContext && oRowContext.getPath() === oBindingContext.getPath()) {
                        oTargetRow = aRows[i];
                        break;
                    }
                }

                // Abrir el popover
                if (oTargetRow && oTargetRow.getDomRef()) {
                    oPopover.openBy(oTargetRow);
                } else {
                    // Fallback: usar la tabla
                    oPopover.openBy(oTable);
                }

            }.bind(this));
        },

        _initializeCheckBoxesEntrega: function () {
            const oView = this.getView();
            const oLicencia = this._currentLicenciaEntrega;

            // Obtener todas las acciones ya guardadas para esta licencia
            const oAccionesModel = oView.getModel("AccionesEntregaModel");
            const aAcciones = oAccionesModel.getData();
            const aAccionesLicencia = aAcciones.filter(a => a.idLicencia === oLicencia.Id);

            // Array de códigos ya seleccionados
            const aCodigosSeleccionados = aAccionesLicencia.map(a => a.accion);

            this._accionesSeleccionadasTemp = {};

            setTimeout(() => {
                // Obtener el List del popover
                const oList = this.byId("listaAccionesEntrega");

                if (!oList) {
                    return;
                }

                // Recorrer los items del List (que son los CustomListItem generados dinámicamente)
                const aItems = oList.getItems();

                aItems.forEach(oItem => {
                    // Dentro de cada CustomListItem hay un CheckBox
                    const oCheckBox = oItem.getContent()[0];

                    if (oCheckBox && oCheckBox.isA("sap.m.CheckBox")) {
                        const sKey = oCheckBox.data("key");
                        const sDescripcion = oCheckBox.data("descripcion");

                        // Verificar si este código está en los ya seleccionados
                        const bSelected = aCodigosSeleccionados.includes(sKey);
                        oCheckBox.setSelected(bSelected);

                        // Si está seleccionado, agregarlo al objeto temporal
                        if (bSelected) {
                            this._accionesSeleccionadasTemp[sKey] = {
                                codigo: sKey,
                                descripcion: sDescripcion
                            };
                        }
                    }
                });

            }, 100);
        },

        formatCodigoAccion: function (sCodigo, sAccion) {
            if (!sCodigo) return "";
            if (!sAccion) return sCodigo;
            return sCodigo + " - " + sAccion;
        },

        onCheckBoxSelectEntrega: function (oEvent) {
            const oCheckBox = oEvent.getSource();
            const sKey = oCheckBox.data("key");
            const sDescripcion = oCheckBox.data("descripcion");
            const bSelected = oCheckBox.getSelected();

            if (!sKey) {
                MessageToast.show("Error: Configuración incorrecta del checkbox");
                return;
            }

            // Asegurar que existe el objeto temporal
            if (!this._accionesSeleccionadasTemp) {
                this._accionesSeleccionadasTemp = {};
            }

            if (bSelected) {
                this._accionesSeleccionadasTemp[sKey] = {
                    codigo: sKey,
                    descripcion: sDescripcion
                };
            } else {
                delete this._accionesSeleccionadasTemp[sKey];
            }
        },

        onGuardarAccionesBackend: function () {
            const oAccionesModel = this.getView().getModel("AccionesEntregaModel");
            const aTodasLasAcciones = oAccionesModel.getData() || [];

            if (aTodasLasAcciones.length === 0) {
                MessageToast.show("No hay acciones para guardar");
                return;
            }

            const aAccionesSinTurno = aTodasLasAcciones.filter(acc =>
                !acc.turnoEntrega || acc.turnoEntrega.trim() === ""
            );

            if (aAccionesSinTurno.length > 0) {
                MessageBox.warning(
                    `Hay ${aAccionesSinTurno.length} acción(es) sin turno de entrega.`,
                    { title: "Turnos sin asignar" }
                );
                return;
            }

            this.showGlobalBusy("Guardando acciones...");

            this._verificarAccionesExistentes(aTodasLasAcciones)
                .then((resultado) => {
                    resultado.acciones.forEach(accion => {
                        console.log(`  - ${accion.accion} (${accion.idLicencia}):`, {
                            tieneAdjuntos: accion.Attachments && accion.Attachments.length > 0,
                            cantidadAdjuntos: accion.Attachments ? accion.Attachments.length : 0
                        });
                    });

                    if (resultado.acciones.length === 0) {
                        this.hideGlobalBusy();
                        MessageToast.show("Todas las acciones ya están guardadas");
                        return Promise.reject("skip");
                    }

                    return this._saveAccionesEnBackend(resultado.acciones, resultado.timestamp);
                })
                .then(() => {
                    this.hideGlobalBusy();
                    MessageToast.show("Acciones guardadas correctamente");
                })
                .catch((error) => {
                    this.hideGlobalBusy();

                    if (error !== "skip") {
                        if (error.responseText) {
                            try {
                                const errorObj = JSON.parse(error.responseText);
                                if (errorObj.error && errorObj.error.message) {
                                    console.error("Mensaje del backend:", errorObj.error.message.value);
                                }
                            } catch (e) {
                                console.error("No se pudo parsear responseText");
                            }
                        }

                        MessageToast.show("Error al guardar acciones", { duration: 3000 });
                    }
                });
        },

        onGuardarAccionesEntrega: function () {
            const oView = this.getView();
            const oLicencia = this._currentLicenciaEntrega;

            if (!oLicencia) {
                MessageToast.show("Error: No se pudo obtener la licencia");
                return;
            }

            const oAccionesTemp = this._accionesSeleccionadasTemp || {};
            const aCodigosSeleccionados = Object.keys(oAccionesTemp);

            if (aCodigosSeleccionados.length === 0) {
                MessageToast.show("Debe seleccionar al menos una acción");
                return;
            }

            const oAccionesModel = oView.getModel("AccionesEntregaModel");
            let aAcciones = oAccionesModel.getData();

            aAcciones = aAcciones.filter(a => a.idLicencia !== oLicencia.Id);

            aCodigosSeleccionados.forEach(sCodigo => {
                aAcciones.push({
                    accion: sCodigo,
                    descripcion: oAccionesTemp[sCodigo].descripcion,
                    idLicencia: oLicencia.Id,
                    equipo: oLicencia.Equnr,
                    equipoCompleto: oLicencia.EquipoCompleto || oLicencia.Equnr,
                    trabajoRealizar: oLicencia.Comments || "Sin descripción",
                    turnoEntrega: oLicencia.TurnoAsignado || "",
                    estado: oLicencia.Licstat || "",
                    condicion: oLicencia.Jobcond || "",
                    equstat: oLicencia.Equstat || "A",
                    empresa: oLicencia.Empresa || "100",
                    tipo: oLicencia.Tipo || "L",
                    anio: oLicencia.Anio || new Date().getFullYear().toString(),
                    _licenciaId: oLicencia.Id,
                    Attachments: []
                });
            });

            oAccionesModel.setData(aAcciones);

            const oLicencesModel = oView.getModel("LicencesJsonModel");
            const sPath = this._currentBindingContextEntrega.getPath();
            oLicencesModel.setProperty(sPath + "/accionSeleccionada", true);

            MessageToast.show(`${aCodigosSeleccionados.length} acción(es) guardada(s) para ${oLicencia.Id}`);

            if (this._oAccionEntregaPopover) {
                this._oAccionEntregaPopover.close();
            }
        },

        _verificarAccionesExistentes: function (aAcciones) {
            return new Promise((resolve) => {
                const oDataService = this.getView().getModel();
                const oFechaTurno = this._oFechaTurnoCreado || this.byId("date").getDateValue();

                if (!oFechaTurno) {
                    resolve({ acciones: aAcciones, timestamp: null });
                    return;
                }

                const year = oFechaTurno.getFullYear();
                const month = oFechaTurno.getMonth();
                const day = oFechaTurno.getDate();
                const timestampMs = new Date(Date.UTC(year, month, day, 0, 0, 0, 0)).getTime();
                const odataTimestamp = `/Date(${timestampMs})/`;

                const aFilters = [
                    new Filter("Dateturno", FilterOperator.EQ, new Date(timestampMs)),
                    new Filter("Empresa", FilterOperator.EQ, "100")
                ];

                oDataService.read("/CatalogoEntregaSet", {
                    filters: aFilters,
                    success: (oData) => {
                        const setExistentes = new Set();
                        (oData.results || []).forEach(item => {
                            setExistentes.add(`${item.Id}_${item.Codigo}`);
                        });

                        const aAccionesNoGuardadas = aAcciones.filter(accion => {
                            const key = `${accion.idLicencia}_${accion.accion}`;
                            const yaExiste = setExistentes.has(key);

                            // Si tiene adjuntos, SIEMPRE guardar
                            if (accion.Attachments && accion.Attachments.length > 0) {
                                return true;
                            }

                            // Si NO tiene adjuntos, verificar si ya existe
                            return !yaExiste;
                        });

                        resolve({
                            acciones: aAccionesNoGuardadas,
                            timestamp: odataTimestamp
                        });
                    },
                    error: () => {
                        resolve({
                            acciones: aAcciones,
                            timestamp: odataTimestamp
                        });
                    }
                });
            });
        },

        _restarUnaHora: function (sTime) {
            if (!sTime || typeof sTime !== 'string') {
                return "00:00";
            }

            // Extraer horas y minutos
            const aParts = sTime.split(":");
            if (aParts.length !== 2) {
                return "00:00";
            }

            let iHoras = parseInt(aParts[0], 10);
            const iMinutos = parseInt(aParts[1], 10);

            // Restar una hora
            iHoras = iHoras - 1;

            // Si es negativo, ajustar a 23 (día anterior)
            if (iHoras < 0) {
                iHoras = 23;
            }

            // Formatear con ceros a la izquierda
            const sHorasFormateadas = iHoras.toString().padStart(2, "0");
            const sMinutosFormateados = iMinutos.toString().padStart(2, "0");

            return `${sHorasFormateadas}:${sMinutosFormateados}`;
        },

        onTurnoEntregaChange: function (oEvent) {
            const oTimePicker = oEvent.getSource();
            const sNewValue = oEvent.getParameter("value");
            const bValid = oEvent.getParameter("valid");

            if (!bValid) {
                MessageToast.show("Formato de hora inválido. Use HH:mm");
                return;
            }

            const oContext = oTimePicker.getBindingContext("AccionesEntregaModel");

            MessageToast.show(`Turno actualizado a ${sNewValue}`);
        },

        onCerrarPopoverEntrega: function () {

            // Limpiar temporal
            this._accionesSeleccionadasTemp = {};

            // Cerrar popover
            if (this._oAccionEntregaPopover) {
                this._oAccionEntregaPopover.close();
            }
        },

        onSelectAccionEntrega: function (sAccion) {

            const oView = this.getView();
            const oLicencia = this._currentLicenciaEntrega;

            if (!oLicencia) {
                return;
            }

            // Crear objeto con los datos a guardar
            const oAccionData = {
                accion: sAccion,
                equipo: oLicencia.Equnr,
                idLicencia: oLicencia.Id,
                trabajoRealizar: oLicencia.Comments || "Sin descripción",
                turno: oLicencia.TurnoAsignado || "Sin turno",
                estado: oLicencia.Licstat || "",
                condicion: oLicencia.Jobcond || "",
                _licenciaId: oLicencia.Id
            };

            const oAccionesModel = oView.getModel("AccionesEntregaModel");
            const aAcciones = oAccionesModel.getData();

            const iExistingIndex = aAcciones.findIndex(a => a.idLicencia === oLicencia.Id);

            if (iExistingIndex >= 0) {
                aAcciones[iExistingIndex] = oAccionData;
                MessageToast.show(`Acción actualizada a "${sAccion}" para ${oLicencia.Id}`);
            } else {
                aAcciones.push(oAccionData);
                MessageToast.show(`Acción "${sAccion}" agregada para ${oLicencia.Id}`);
            }

            oAccionesModel.setData(aAcciones);

            const oLicencesModel = oView.getModel("LicencesJsonModel");
            const sPath = this._currentBindingContextEntrega.getPath();
            oLicencesModel.setProperty(sPath + "/accionSeleccionada", true);

            // Cerrar popover
            if (this._oAccionEntregaPopover) {
                this._oAccionEntregaPopover.close();
            }
        },

        onSelectAccion: function (sAccion) {
            const oView = this.getView();
            const oLicencia = this._currentLicenciaEntrega;

            if (!oLicencia) {
                MessageToast.show("Error: No se pudo obtener la licencia");
                return;
            }

            // Crear objeto con los datos a guardar
            const oAccionData = {
                accion: sAccion,
                equipo: oLicencia.Equnr,
                idLicencia: oLicencia.Id,
                trabajoRealizar: oLicencia.Comments || "Sin descripción",
                turno: oLicencia.TurnoAsignado || "Sin turno",
                estado: oLicencia.Licstat || "",
                condicion: oLicencia.conditionWork || "",
                _licenciaId: oLicencia.Id
            };

            // Agregar al modelo de acciones
            const oAccionesModel = oView.getModel("AccionesEntregaModel");
            if (!oAccionesModel) {
                MessageToast.show("Error: Modelo no encontrado");
                return;
            }

            const aAcciones = oAccionesModel.getData();
            const iExistingIndex = aAcciones.findIndex(a => a.idLicencia === oLicencia.Id);

            if (iExistingIndex >= 0) {
                aAcciones[iExistingIndex] = oAccionData;
                MessageToast.show(`Acción actualizada a "${sAccion}"`);
            } else {
                aAcciones.push(oAccionData);
                MessageToast.show(`Acción "${sAccion}" agregada`);
            }

            oAccionesModel.setData(aAcciones);

            const oLicencesModel = oView.getModel("LicencesJsonModel");
            const sPath = this._currentBindingContextEntrega.getPath();
            oLicencesModel.setProperty(sPath + "/accionSeleccionada", true);

            // Cerrar popover
            if (this._oAccionEntregaPopover) {
                this._oAccionEntregaPopover.close();
            }
        },

        onRemoveAccionEntrega: function (oEvent) {
            const oButton = oEvent.getSource();
            const oView = this.getView();

            const oBindingContext = oButton.getBindingContext("AccionesEntregaModel");
            const oAccion = oBindingContext.getObject();
            const iIndex = parseInt(oBindingContext.getPath().split("/")[1]);

            MessageBox.confirm(
                `¿Desea eliminar la acción "${oAccion.accion}" para la licencia ${oAccion.idLicencia}?`,
                {
                    title: "Confirmar eliminación",
                    onClose: (sAction) => {
                        if (sAction === MessageBox.Action.OK) {
                            const tieneKeysBackend = oAccion._licenciaId &&
                                oAccion.idLicencia &&
                                oAccion.accion;

                            if (tieneKeysBackend) {
                                this.showGlobalBusy("Eliminando acción...");

                                const oDataService = this.getView().getModel();
                                const oFechaTurno = this._oFechaTurnoCreado || this.byId("date").getDateValue();

                                // Construir la key completa para el backend
                                const sKey = oDataService.createKey("/CatalogoEntregaSet", {
                                    Id: oAccion.idLicencia,
                                    Empresa: oAccion.empresa || "100",
                                    Tipo: oAccion.tipo || "L",
                                    Anio: oAccion.anio || new Date().getFullYear().toString(),
                                    Dateturno: oFechaTurno,
                                    Codigo: oAccion.accion
                                });

                                oDataService.remove(sKey, {
                                    success: () => {
                                        const oAccionesModel = oView.getModel("AccionesEntregaModel");
                                        const aAcciones = oAccionesModel.getData();
                                        aAcciones.splice(iIndex, 1);
                                        oAccionesModel.setData(aAcciones);
                                        oAccionesModel.refresh(true);

                                        // Verificar si quedan más acciones para esta licencia
                                        const bTieneAcciones = aAcciones.some(a => a.idLicencia === oAccion.idLicencia);

                                        if (!bTieneAcciones) {
                                            const oLicencesModel = oView.getModel("LicencesJsonModel");
                                            const aLicencias = oLicencesModel.getData();
                                            const oLicencia = aLicencias.find(lic => lic.Id === oAccion.idLicencia);

                                            if (oLicencia) {
                                                oLicencia.accionSeleccionada = false;
                                                oLicencesModel.refresh();
                                            }
                                        }

                                        MessageToast.show("Archivo eliminado: " + oAccion.accion);
                                        this.onGuardarAccionesBackend();
                                    },
                                    error: (oError) => {
                                        this.hideGlobalBusy();
                                        const bNoEncontrado = oError.statusCode === "404" || oError.statusCode === 404;

                                        if (bNoEncontrado) {
                                            const oAccionesModel = oView.getModel("AccionesEntregaModel");
                                            const aAcciones = oAccionesModel.getData();
                                            aAcciones.splice(iIndex, 1);
                                            oAccionesModel.setData(aAcciones);
                                            oAccionesModel.refresh(true);

                                            MessageToast.show("Acción eliminada");

                                            this.onGuardarAccionesBackend();
                                        } else {
                                            MessageBox.error("Error al eliminar la acción del backend.");
                                        }
                                    }
                                });

                            } else {
                                const oAccionesModel = oView.getModel("AccionesEntregaModel");
                                const aAcciones = oAccionesModel.getData();
                                aAcciones.splice(iIndex, 1);
                                oAccionesModel.setData(aAcciones);

                                // Verificar si quedan más acciones para esta licencia
                                const bTieneAcciones = aAcciones.some(a => a.idLicencia === oAccion.idLicencia);

                                if (!bTieneAcciones) {
                                    const oLicencesModel = oView.getModel("LicencesJsonModel");
                                    const aLicencias = oLicencesModel.getData();
                                    const oLicencia = aLicencias.find(lic => lic.Id === oAccion.idLicencia);

                                    if (oLicencia) {
                                        oLicencia.accionSeleccionada = false;
                                        oLicencesModel.refresh();
                                    }
                                }

                                MessageToast.show("Acción eliminada");
                            }
                        }
                    }
                }
            );
        },

        _limpiarAccionesEntrega: function () {
            const oView = this.getView();

            const oAccionesModel = oView.getModel("AccionesEntregaModel");
            if (oAccionesModel) {
                const aAcciones = oAccionesModel.getData();
                const iAccionesAnteriores = Array.isArray(aAcciones) ? aAcciones.length : 0;
                oAccionesModel.setData([]);
            }

            const oLicencesModel = oView.getModel("LicencesJsonModel");
            if (oLicencesModel) {
                const aLicencias = oLicencesModel.getData();
                if (Array.isArray(aLicencias)) {
                    let iMarcasLimpiadas = 0;
                    aLicencias.forEach(oLic => {
                        if (oLic.accionSeleccionada) {
                            oLic.accionSeleccionada = false;
                            iMarcasLimpiadas++;
                        }
                    });
                    if (iMarcasLimpiadas > 0) {
                        oLicencesModel.refresh();
                    }
                }
            }
        },

        _sincronizarAccionesConLicencias: function () {
            const oView = this.getView();
            const oLicencesModel = oView.getModel("LicencesJsonModel");
            const oAccionesModel = oView.getModel("AccionesEntregaModel");

            if (!oLicencesModel || !oAccionesModel) {
                return;
            }

            const aLicenciasActuales = oLicencesModel.getData() || [];
            const aAcciones = oAccionesModel.getData() || [];

            const aIdsLicenciasActuales = aLicenciasActuales.map(lic => lic.Id);

            const aAccionesFiltradas = aAcciones.filter(accion => {
                const bExiste = aIdsLicenciasActuales.includes(accion.idLicencia);
                if (!bExiste) {
                }
                return bExiste;
            });

            // Actualizar modelo
            oAccionesModel.setData(aAccionesFiltradas);

            // Actualizar marcas en licencias
            aLicenciasActuales.forEach(oLic => {
                const bTieneAcciones = aAccionesFiltradas.some(a => a.idLicencia === oLic.Id);
                oLic.accionSeleccionada = bTieneAcciones;
            });

            oLicencesModel.refresh();
        },
        //------------------------------------------------------------------------------

        cargarModelos: function () {
            const oView = this.getView()
            ModelHelper.getModel("HorarioLicenciaJsonModel", oView);
            ModelHelper.getModel("consolasModel", oView)
            ModelHelper.getModel("LocalFilterJsonModel", oView);
            ModelHelper.getModel("ColorModel", oView).setProperty("/Color", "white");

            ModelHelper.getModel("tabsControl", oView).setData({ activeTab: "LIC" });
            ModelHelper.getModel("LicencesJsonModel", oView)

            const sConsolasUrl = sap.ui.require.toUrl("transener/sistemadeturnos/model/ConsolasModel.json");
            ModelHelper.getModel("consolasModel", oView).loadData(sConsolasUrl);

            const sEnabledUrl = sap.ui.require.toUrl("transener/sistemadeturnos/model/EnabledModel.json");
            ModelHelper.getModel("enabledModel", oView).loadData(sEnabledUrl);

            // ⬇️ MODELOS PARA FILTROS AVANZADOS ⬇️

            // 1. HardCodeModel (datos hardcoded)
            const oHardCodeModel = HardCodeModel.getModel();
            oView.setModel(oHardCodeModel, "HardCodeModel");

            // 2. FiltersJsonModel (estructura de filtros)
            const oFiltersModel = ModelHelper.getModel("FiltersJsonModel", oView);
            const sFiltersPath = sap.ui.require.toUrl("transener/sistemadeturnos/model/FiltersJsonModel.json");
            oFiltersModel.loadData(sFiltersPath, "", false);

            // 3. CheckAdvancedFiltersModel (para checkboxes de filtros)
            ModelHelper.getModel("CheckAdvancedFiltersModel", oView).setData({
                Aro: false,
                Bloqueo: false,
                Rdisparo: false
            });

            // 4. Modelos adicionales para filtros (se cargan cuando sea necesario)
            ModelHelper.getModel("WorkPlacesJsonModel", oView);
            ModelHelper.getModel("PersonalHabilitadoModel", oView);
            ModelHelper.getModel("TipoEquipoJsonModel", oView);
            ModelHelper.getModel("TiposIntervencion", oView);
            ModelHelper.getModel("RepositionTimes", oView);

            // 5. Modelo de Regiones
            ModelHelper.getModel("RegionesJsonModel", oView);
            this._loadRegiones();

            // 6. Modelo de ET
            ModelHelper.getModel("EstacionesJsonModel", oView);

            // 7. Funciones de carga filtros avanzados
            this._loadEstaciones();
            this._loadPuestosTrabajo();
            this._loadTipoEquipo();
            this._loadRepositionTimes();
            this._loadPersonalHabilitado();
        },

        getVersion: function () {
            const oComponent = this.getOwnerComponent();
            let jsonModel = sap.ui.getCore().getModel("appVersion");

            if (!jsonModel) {
                jsonModel = new sap.ui.model.json.JSONModel();
                jsonModel.setSizeLimit(9999);

                const sVersion = oComponent.getManifestEntry("/sap.app/applicationVersion/version");

                jsonModel.setData({ version: sVersion });

                sap.ui.getCore().setModel(jsonModel, "appVersion");
                this.getView().setModel(jsonModel, "appVersion");
            } else if (!this.getView().getModel("appVersion")) {
                this.getView().setModel(jsonModel, "appVersion");
            }
        },

        /* getBaseURL: function () {
            const appId = this.getOwnerComponent().getManifestEntry("/sap.app/id");
            const appPath = appId.replaceAll(".", "/");
            const appModulePath = jQuery.sap.getModulePath(appPath);

            let jsonModel = sap.ui.getCore().getModel("appCurrentInfo");
            if (!jsonModel) {
                jsonModel = new sap.ui.model.json.JSONModel();
                jsonModel.setSizeLimit(9999);
                jsonModel.setData({ appUrl: appModulePath });
                sap.ui.getCore().setModel(jsonModel, "appCurrentInfo");
            }

            return appModulePath;
        }, */
        onTabSelect: function (oEvent) {
            const key = oEvent.getParameter("key");
            this.getView().getModel("tabsControl").setProperty("/activeTab", key);
        },
        onSelectTurno: function (oEvent) {
            this.showGlobalBusy("Buscando turnos creados…");
            const oView = this.getView();
            const oDataService = this.getView().getModel();

            this._limpiarAccionesEntrega();

            const oNotificationModel = ModelHelper.getModel("LicensesNotificationModel", oView);
            oNotificationModel.setData({
                visible: false,
                count: 0,
                message: "",
                type: ""
            });

            ModelHelper.getModel("enabledModel", oView).setData({
                btnCrear: true,
                btnGuardar: true,
                btnEnviar: true
            });

            const oDatePicker = oEvent.getSource();
            const sSelectedDate = oDatePicker.getDateValue();
            const sFormattedDate = FormatHelper.formatDate(sSelectedDate);

            ModelHelper.getModel("LicencesTurnoJsonModel", oView)
                .setProperty("/FechaTurno", sFormattedDate);

            const aFilters = [];
            aFilters.push(new Filter("Dateturno", FilterOperator.EQ, this.byId("date").getDateValue()));
            aFilters.push(new Filter("Empresa", FilterOperator.EQ, "100"));

            const sEntity = "/TurnosLicenciasSet";


            oDataService.read(sEntity, {
                filters: aFilters,
                success: (oData) => {
                    this._validateAndProcessLicenses(oData.results, sSelectedDate)
                        .then((aLicenciasProcesadas) => {

                            return this.successSelectTurno({ results: aLicenciasProcesadas });
                        })
                        .catch((err) => {
                            return this.successSelectTurno(oData);
                        })
                        .then(() => {
                            // ✅ CARGAR ACCIONES después de cargar licencias
                            return this._cargarAccionesDesdeBackend(sSelectedDate);
                        })
                        .finally(() => {
                            this.hideGlobalBusy();
                        });
                },
                error: (oError) => {
                    const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
                    oLicencesModel.setData([]);
                    Utils.onCountItems(oView, []);
                    this.hideGlobalBusy();
                }
            });

            this._oFechaTurnoCreado = null;
        },


        /* ------------------------------------------ TRAMITACION---------------------- */

        _validateAndProcessLicenses: function (aLicencias, dFechaSeleccionada) {
            const oModel = this.getView().getModel();

            const aPromises = aLicencias.map((oLicencia, index) => {
                return this._validateSingleLicense(oModel, oLicencia, dFechaSeleccionada, index + 1, aLicencias.length);
            });

            return Promise.all(aPromises)
                .then((aLicenciasValidadas) => {

                    return aLicenciasValidadas;
                });
        },

        _validateSingleLicense: function (oModel, oLicencia, dFecha, current, total) {
            return new Promise((resolve) => {

                const aFilters = [
                    new Filter("Empresa", FilterOperator.EQ, oLicencia.Empresa || "100"),
                    new Filter("Id", FilterOperator.EQ, oLicencia.Id),
                    new Filter("Anio", FilterOperator.EQ, String(oLicencia.Anio || "2025"))
                ];

                const startTime = Date.now();

                oModel.read("/LicenciaEstadoDiarioSet", {
                    filters: aFilters,
                    success: (oData) => {
                        const duration = Date.now() - startTime;
                        const aResults = oData.results || [];


                        if (aResults.length === 0) {
                            resolve({
                                ...oLicencia,
                                tramitacionColor: null,
                                tramitacionProblematica: false,
                                tramitacionEstado: null,
                                tramitacionDetalles: [],
                                calendarioCompleto: [],
                                tramitacionPorFecha: {}
                            });
                            return;
                        }

                        aResults.forEach(r => {
                            const fechaFormateada = this._formatDateYYYYMMDD(r.Fecha);
                            const desc = this._getEstadoDescription(r.Estado);
                        });

                        let tramitacionColor = null;
                        let tramitacionProblematica = false;
                        let tramitacionEstado = null;
                        const aEstadosProblematicos = [];
                        const tramitacionPorFecha = {};

                        aResults.forEach(item => {
                            if (item.Estado === 'AS' || item.Estado === 'NA' || item.Estado === 'CD' || item.Estado === 'CC') {
                                aEstadosProblematicos.push(item);

                                const fechaItem = this._formatDateYYYYMMDD(item.Fecha);

                                if (item.Estado === 'AS' || item.Estado === 'NA') {
                                    tramitacionPorFecha[fechaItem] = 'red';
                                } else if (item.Estado === 'CD' || item.Estado === 'CC') {
                                    if (!tramitacionPorFecha[fechaItem]) {
                                        tramitacionPorFecha[fechaItem] = 'yellow';
                                    }
                                }
                            }
                        });

                        if (aEstadosProblematicos.length > 0) {
                            aEstadosProblematicos.forEach(item => {
                                const fechaFormateada = this._formatDateYYYYMMDD(item.Fecha);
                            });
                        }

                        const hasAnulada = aEstadosProblematicos.some(item => item.Estado === 'AS');
                        const hasNoAutorizada = aEstadosProblematicos.some(item => item.Estado === 'NA');
                        const hasCondicionada = aEstadosProblematicos.some(item =>
                            item.Estado === 'CD' || item.Estado === 'CC'
                        );

                        if (hasAnulada) {
                            tramitacionColor = 'red';
                            tramitacionProblematica = true;
                            tramitacionEstado = 'AS';
                        } else if (hasNoAutorizada) {
                            tramitacionColor = 'red';
                            tramitacionProblematica = true;
                            tramitacionEstado = 'NA';
                        } else if (hasCondicionada) {
                            tramitacionColor = 'yellow';
                            tramitacionProblematica = true;
                            tramitacionEstado = 'CD';
                        }

                        resolve({
                            ...oLicencia,
                            tramitacionColor: tramitacionColor,
                            tramitacionProblematica: tramitacionProblematica,
                            tramitacionEstado: tramitacionEstado,
                            tramitacionDetalles: aEstadosProblematicos,
                            calendarioCompleto: aResults,
                            tramitacionPorFecha: tramitacionPorFecha
                        });
                    },
                    error: (oError) => {
                        const duration = Date.now() - startTime;

                        if (oError.responseText) {
                            try {
                                const errorObj = JSON.parse(oError.responseText);
                            } catch (e) {
                                console.error(`  │    ResponseText:`, oError.responseText);
                            }
                        }

                        resolve({
                            ...oLicencia,
                            tramitacionColor: null,
                            tramitacionProblematica: false,
                            tramitacionEstado: null,
                            tramitacionDetalles: [],
                            calendarioCompleto: [],
                            tramitacionPorFecha: {}
                        });
                    }
                });
            });
        },

        _getTramitacionColorPorFecha: function (oLicencia, dFechaTurno) {

            if (!oLicencia || !oLicencia.tramitacionPorFecha || !dFechaTurno) {
                return null;
            }

            const sFechaTurno = this._formatDateYYYYMMDD(dFechaTurno);

            const color = oLicencia.tramitacionPorFecha[sFechaTurno] || null;

            return color;
        },

        _formatDateYYYYMMDD: function (date) {
            if (!date) return "";

            let oDate;

            if (date instanceof Date) {
                oDate = date;
            }
            else if (typeof date === "string" && !date.startsWith("/Date(")) {
                oDate = new Date(date);
            }
            else if (typeof date === "string" && date.startsWith("/Date(")) {
                const timestamp = parseInt(date.match(/\d+/)[0]);
                oDate = new Date(timestamp);
            }
            else if (typeof date === "object" && date.__edmType === "Edm.DateTime") {
                oDate = new Date(date);
            }
            else {
                try {
                    oDate = new Date(date);
                } catch (e) {
                    return "";
                }
            }

            if (isNaN(oDate.getTime())) {
                return "";
            }

            const year = oDate.getFullYear();
            const month = String(oDate.getMonth() + 1).padStart(2, "0");
            const day = String(oDate.getDate()).padStart(2, "0");

            return `${year}-${month}-${day}`;
        },

        _getEstadoDescription: function (estado) {
            const estados = {
                "AS": "(Anulada Solicitante)",
                "NA": "(No Autorizada)",
                "CD": "(Condicionada)",
                "AU": "(Autorizada)"
            };
            return estados[estado] || "";
        },

        onOpenCalendarioTramitacion: function (oEvent) {
            const oButton = oEvent.getSource();
            const oView = this.getView();

            const oBindingContext = oButton.getBindingContext("LicencesJsonModel");
            if (!oBindingContext) {
                sap.m.MessageToast.show("No se pudo obtener información de la licencia");
                return;
            }

            const oLicencia = oBindingContext.getObject();

            if (this._oCalendarioDialog) {
                this._oCalendarioDialog.destroy();
                this._oCalendarioDialog = null;
            }

            if (!oLicencia.calendarioCompleto || oLicencia.calendarioCompleto.length === 0) {
                this._showEmptyCalendarioDialog(oLicencia.Id);
                return;
            }

            this._showCalendarioDialog(oLicencia);
        },

        _showEmptyCalendarioDialog: function (sLicenciaId) {
            const oView = this.getView();

            const oTable = new sap.m.Table({
                columns: [
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Fecha" })
                    }),
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Estado" })
                    }),
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Observación" })
                    })
                ]
            });

            oTable.addItem(
                new sap.m.ColumnListItem({
                    cells: [
                        new sap.m.Text({ text: "" }),
                        new sap.m.Text({
                            text: "No hay días agregados...",
                            textAlign: "Center"
                        }),
                        new sap.m.Text({ text: "" })
                    ]
                })
            );

            this._oCalendarioDialog = new sap.m.Dialog({
                title: "Calendario Tramitación",
                contentWidth: "550px",
                contentHeight: "200px",
                content: [
                    new sap.m.VBox({
                        items: [oTable]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                endButton: new sap.m.Button({
                    text: "Cerrar",
                    press: function () {
                        this._oCalendarioDialog.close();
                    }.bind(this)
                })
            });

            oView.addDependent(this._oCalendarioDialog);
            this._oCalendarioDialog.open();
        },

        _showCalendarioDialog: function (oLicencia) {
            const oView = this.getView();

            const aCalendarioData = oLicencia.calendarioCompleto.map(item => {
                const fechaFormateada = this._formatDateYYYYMMDD(item.Fecha);

                return {
                    FechaDisplay: this._formatDateToDisplay(item.Fecha),
                    EstadoTexto: this._getEstadoTextoCompleto(item.Estado),
                    Observaciones: item.Observaciones || '',
                    ColorIndicador: this._getColorByEstado(item.Estado),
                    _fechaOrden: fechaFormateada
                };
            });

            aCalendarioData.sort((a, b) => {
                return new Date(a._fechaOrden) - new Date(b._fechaOrden);
            });

            const oModel = new sap.ui.model.json.JSONModel({
                estados: aCalendarioData
            });

            const iRowCount = aCalendarioData.length;
            const iRowHeight = 48;
            const iHeaderHeight = 48;
            const iDialogPadding = 80;
            const iMaxHeight = 400;

            const iCalculatedHeight = Math.min(
                (iRowCount * iRowHeight) + iHeaderHeight + iDialogPadding,
                iMaxHeight
            );

            const oTable = new sap.m.Table({
                growing: false,
                columns: [
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Fecha" }),
                        width: "110px"
                    }),
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Estado" }),
                        width: "240px"
                    }),
                    new sap.m.Column({
                        header: new sap.m.Label({ text: "Observación" })
                    })
                ],
                items: {
                    path: "/estados",
                    template: new sap.m.ColumnListItem({
                        cells: [
                            new sap.m.Text({
                                text: "{FechaDisplay}"
                            }),
                            new sap.m.HBox({
                                alignItems: "Center",
                                items: [
                                    new sap.ui.core.Icon({
                                        src: "sap-icon://circle-task-2",
                                        color: "{ColorIndicador}",
                                        size: "0.875rem"
                                    }).addStyleClass("sapUiTinyMarginEnd"),
                                    new sap.m.Text({
                                        text: "{EstadoTexto}"
                                    })
                                ]
                            }),
                            new sap.m.Text({
                                text: "{Observaciones}"
                            })
                        ]
                    })
                }
            });

            oTable.setModel(oModel);

            this._oCalendarioDialog = new sap.m.Dialog({
                title: "Calendario Tramitación",
                contentWidth: "550px",
                contentHeight: iCalculatedHeight + "px",
                content: [
                    new sap.m.VBox({
                        items: [oTable]
                    }).addStyleClass("sapUiSmallMargin")
                ],
                endButton: new sap.m.Button({
                    text: "Cerrar",
                    press: function () {
                        this._oCalendarioDialog.close();
                    }.bind(this)
                })
            });

            oView.addDependent(this._oCalendarioDialog);
            this._oCalendarioDialog.open();
        },

        _formatDateToDisplay: function (date) {
            const formatted = this._formatDateYYYYMMDD(date);
            if (!formatted) return "";

            const [year, month, day] = formatted.split('-');
            return `${day}/${month}/${year}`;
        },

        _getEstadoTextoCompleto: function (sEstado) {
            const mEstados = {
                "AS": "Anulada por el solicitante",
                "NA": "No Autorizada",
                "CD": "Condicionada",
                "CC": "Condicionada",
                "AU": "Autorizada"
            };
            return mEstados[sEstado] || `Estado ${sEstado}`;
        },

        _getColorByEstado: function (sEstado) {
            switch (sEstado) {
                case 'AS': // Anulada por solicitante
                case 'NA': // No autorizada
                    return "#BB0000"; // Rojo
                case 'CD': // Condicionada
                case 'CC':
                    return "#E78C07"; // Amarillo/Naranja
                default:
                    return "#5E696E"; // Gris
            }
        },

        /* ---------------------- TRAMITACION-------------------------- */
        onSearch: function () {
            this._openFechaTurnoPopup();
        },

        _checkExistingTurnoAndProceed: function (oDateValue) {
            const oView = this.getView();
            const oDataService = oView.getModel();

            this._oFechaTurnoCreado = oDateValue;

            const sFormattedDate = FormatHelper.formatDate(oDateValue);
            ModelHelper.getModel("LicencesTurnoJsonModel", oView).setProperty("/FechaTurno", sFormattedDate);

            this.showGlobalBusy("Buscando turnos creados…");

            const aFilters = [
                new sap.ui.model.Filter("Dateturno", sap.ui.model.FilterOperator.EQ, oDateValue),
                new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, "100")
            ];

            oDataService.read("/TurnosLicenciasSet", {
                filters: aFilters,
                success: (oData) => {
                    const aRes = (oData && oData.results) ? oData.results : [];

                    if (aRes.length) {
                        this.hideGlobalBusy();
                        this._resetDefaultTurnoModel();
                        sap.m.MessageBox.warning("Ya existe un turno para esta fecha.", {
                            actions: ["Editar", "Cancelar"],
                            emphasizedAction: "Editar",
                            onClose: (sAction) => {
                                if (sAction === "Editar") {
                                    this.showGlobalBusy("Cargando turno…");
                                    this._resetDefaultTurnoModel();

                                    ModelHelper.getModel("enabledModel", oView).setData({
                                        btnCrear: true,
                                        btnGuardar: true,
                                        btnEnviar: true
                                    });

                                    const oDatePicker = this.byId("date");
                                    if (oDatePicker) {
                                        oDatePicker.setDateValue(oDateValue);
                                    }

                                    this._validateAndProcessLicenses(aRes, oDateValue)
                                        .then((aLicenciasProcesadas) => {
                                            return this.successSelectTurno({ results: aLicenciasProcesadas });
                                        })
                                        .catch((err) => {
                                            return this.successSelectTurno(oData);
                                        })
                                        .finally(() => {
                                            this.hideGlobalBusy();
                                        });
                                }
                            }
                        });

                        return;
                    }


                    this.hideGlobalBusy();
                    this._resetDefaultTurnoModel();

                    const oDatePicker = this.byId("date");
                    if (oDatePicker && oDateValue) {
                        oDatePicker.setDateValue(oDateValue);
                    }

                    this._doSearchTurnos(oDateValue);
                },
                error: (oError) => {
                    const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
                    oLicencesModel.setData([]);
                    oLicencesModel.refresh();
                    Utils.onCountItems(this.getView(), []);
                    this.hideGlobalBusy();
                }
            });
        },


        _openFechaTurnoPopup: function () {
            var oView = this.getView();
            var that = this;

            if (this._oFechaTurnoDialog) {
                this._oFechaTurnoPicker.setDateValue(new Date());
                this._oFechaTurnoDialog.open();
                return;
            }

            this._oFechaTurnoPicker = new sap.m.DatePicker({
                width: "100%",
                dateValue: new Date(),
                displayFormat: "dd/MM/yyyy",
                valueFormat: "yyyy-MM-dd",
                placeholder: "Seleccione una fecha"
            });

            this._oFechaTurnoDialog = new sap.m.Dialog({
                title: "Seleccionar fecha",
                contentWidth: "22rem",
                content: [
                    new sap.m.VBox({
                        width: "100%",
                        alignItems: "Center",
                        justifyContent: "Center",
                        items: [
                            this._oFechaTurnoPicker.addStyleClass("sapUiSmallMarginTop")
                        ]
                    })
                ],
                beginButton: new sap.m.Button({
                    text: "Crear",
                    type: "Emphasized",
                    press: function () {
                        var oDateValue = that._oFechaTurnoPicker.getDateValue();
                        if (!oDateValue) {
                            sap.m.MessageToast.show("Seleccione una fecha");
                            return;
                        }

                        // ✅ VALIDACIÓN: No permitir crear turnos con fecha anterior a hoy
                        var oFechaTurno = new Date(oDateValue);
                        var oFechaTurnoNormalizada = new Date(Date.UTC(
                            oFechaTurno.getUTCFullYear(),
                            oFechaTurno.getUTCMonth(),
                            oFechaTurno.getUTCDate(),
                            0, 0, 0, 0
                        ));

                        var oHoy = new Date();
                        var oHoyNormalizada = new Date(Date.UTC(
                            oHoy.getFullYear(),
                            oHoy.getMonth(),
                            oHoy.getDate(),
                            0, 0, 0, 0
                        ));

                        if (oFechaTurnoNormalizada.getTime() < oHoyNormalizada.getTime()) {
                            sap.m.MessageBox.error(
                                "No se puede crear un turno con fecha anterior al día de hoy. Por favor, seleccione una fecha válida.",
                                {
                                    title: "Fecha no válida"
                                }
                            );
                            return;
                        }

                        that._oFechaTurnoDialog.close();
                        that._checkExistingTurnoAndProceed(oDateValue);
                    }
                }),
                endButton: new sap.m.Button({
                    text: "Cancelar",
                    press: function () {
                        that._oFechaTurnoDialog.close();
                    }
                })
            });

            oView.addDependent(this._oFechaTurnoDialog);
            this._oFechaTurnoDialog.open();
        },


        _doSearchTurnos: function (FechaTurno) {
            var oTable = this.byId("turnosTable");
            var oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());

            oLicencesModel.setData([]);
            oTable.setBusy(true);

            TurnosService.search({ FechaTurno, oView: this.getView(), isRefresh: true })
                .then((data) => {
                    const bIsEditable = this._isEditableTurno(FechaTurno);

                    data.forEach(item => {
                        item.isEditable = bIsEditable;
                    });

                    // ✅ OBTENER DESCRIPCIONES DE EQUIPOS
                    const aEquiposUnicos = data
                        .map(item => ({
                            Equnr: (item.Equnr || "").trim(),
                            Tplnr: (item.Tplnr || "").trim()
                        }))
                        .filter(item => item.Equnr && item.Tplnr);

                    const aEquiposUnicosDedup = Array.from(
                        new Map(aEquiposUnicos.map(item => [JSON.stringify(item), item])).values()
                    );

                    if (aEquiposUnicosDedup.length === 0) {
                        // Sin equipos, cargar sin descripciones
                        oLicencesModel.setData(data);
                        oLicencesModel.refresh();
                        oTable.setBusy(false);
                        Utils.onCountItems(this.getView(), data);
                        this._updateEditableState();
                        return;
                    }

                    // Obtener descripciones
                    this._obtenerDescripcionesEquipos(aEquiposUnicosDedup)
                        .then((oDescripcionesEquipos) => {
                            // Agregar descripciones
                            data.forEach(item => {
                                const sEquipoNormalizado = (item.Equnr || "").trim();
                                item.DescEquipo = oDescripcionesEquipos[sEquipoNormalizado] || "";
                                item.EquipoCompleto = item.DescEquipo
                                    ? item.Equnr + " - " + item.DescEquipo
                                    : item.Equnr;
                            });

                            oLicencesModel.setData(data);
                            oLicencesModel.refresh();
                            oTable.setBusy(false);
                            Utils.onCountItems(this.getView(), data);
                            this._updateEditableState();
                        })
                        .catch((error) => {
                            oLicencesModel.setData(data);
                            oLicencesModel.refresh();
                            oTable.setBusy(false);
                            Utils.onCountItems(this.getView(), data);
                            this._updateEditableState();
                        });
                })
        },


        // onSearch: function () {
        //     var dateTurno = this.byId("date");
        //     var oTable = this.byId("turnosTable");

        //     var oDateValue = dateTurno.getDateValue();

        //     if (!oDateValue) {
        //         sap.m.MessageToast.show("Seleccione una fecha");
        //         return;
        //     }


        //     const FechaTurno = oDateValue;

        //     var oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());
        //     oLicencesModel.setData([]);
        //     oTable.setBusy(true);


        //     TurnosService.search({ FechaTurno, oView: this.getView(), isRefresh: false })
        //         .then((data) => {
        //             oLicencesModel.setData(data);
        //             oLicencesModel.refresh();
        //             oTable.setBusy(false);
        //             Utils.onCountItems(this.getView(), data);
        //         })
        //         .catch((error) => {
        //             console.error("Error en la búsqueda:", error);
        //             oLicencesModel.setData([]);
        //             oLicencesModel.refresh();
        //             oTable.setBusy(false);
        //         });

        //     this.closeDialog();
        // },
        _resetDefaultTurnoModel: function () {
            const oView = this.getView();

            const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
            if (oLicencesModel) {
                oLicencesModel.setData([]);
                oLicencesModel.refresh(true);
            }

            Utils.onCountItems(oView, []);
        },


        successSelectTurno: function (data) {
            const oView = this.getView();
            const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
            const oDataModel = this.getView().getModel();

            const aResults = Array.isArray(data?.results) ? data.results : [];

            if (!aResults.length) {
                oLicencesModel.setData([]);
                Utils.onCountItems(oView, []);
                return Promise.resolve();
            }

            // FILTRO DE ESTADOS PERMITIDOS
            // Estados permitidos según requisitos:
            // 01 = Autorizada 
            // 07 = Coordinada 
            // 08 = Entregada 
            // 10 = Suspendida 
            // 23 = En Trámite 
            const ESTADOS_PERMITIDOS = ["01", "07", "08", "10", "23"];

            const aPromises = aResults.map((turnoLicencia) => {
                return new Promise((resolve, reject) => {
                    const sPath = oDataModel.createKey("/LicenciaTrabajoSet", {
                        Empresa: turnoLicencia.Empresa,
                        Id: turnoLicencia.Id,
                        Tipo: turnoLicencia.Tipo,
                        Anio: turnoLicencia.Anio
                    });

                    oDataModel.read(sPath, {
                        urlParameters: {
                            "$expand": "HorariosPorLicencia_nav,CoordinacionesLicencia_nav,ObservacionesLicencia_nav,TramitacionesLicencia_nav,SuspensionLicencia_nav,ReanudacionLicencia_nav,TransferenciaJefeTrabajo_nav,DevolucionLicencia_nav,EntregasLicencia_nav,AttachmentXLicencia_nav,EsquemaUnifilar_nav,TurnosLicencias_nav"
                        },
                        success: (oData) => {
                            // Si es agregada manualmente, SIEMPRE pasa (sin validar estado)
                            const bAgrmanual = turnoLicencia.Agrmanual === true;

                            if (!bAgrmanual && !ESTADOS_PERMITIDOS.includes(oData.Licstat)) {
                                resolve(null);
                                return;
                            }

                            const licenciaCompleta = {
                                ...oData,
                                Timbeg: oData.Timbeg || null,
                                Timend: oData.Timend || null,
                                Gdate: oData.Gdate || null,
                                TurnoAsignado: turnoLicencia.Turno || "",
                                Agrmanual: turnoLicencia.Agrmanual || false,
                                Comentarios: turnoLicencia.Comentarios || oData.Comentarios || "",
                                Enviado: turnoLicencia.Enviado || false,
                                tramitacionColor: turnoLicencia.tramitacionColor || null,
                                tramitacionProblematica: turnoLicencia.tramitacionProblematica || false,
                                tramitacionEstado: turnoLicencia.tramitacionEstado || null,
                                tramitacionDetalles: turnoLicencia.tramitacionDetalles || [],
                                calendarioCompleto: turnoLicencia.calendarioCompleto || [],
                                tramitacionPorFecha: turnoLicencia.tramitacionPorFecha || {}
                            };

                            resolve(licenciaCompleta);
                        },
                        error: (oError) => {
                            LicenseService.FIND(turnoLicencia, oDataModel)
                                .then(result => {
                                    const bAgrmanual = turnoLicencia.Agrmanual === true;

                                    if (!bAgrmanual && !ESTADOS_PERMITIDOS.includes(result.Licstat)) {
                                        resolve(null);
                                        return;
                                    }

                                    if (!result.Timbeg && turnoLicencia.Timbeg) {
                                        result.Timbeg = turnoLicencia.Timbeg;
                                    }

                                    result.Agrmanual = turnoLicencia.Agrmanual || false;
                                    result.Comentarios = turnoLicencia.Comentarios || result.Comentarios || "";
                                    result.Enviado = turnoLicencia.Enviado || false;
                                    result.TurnoAsignado = turnoLicencia.Turno || "";

                                    resolve(result);
                                })
                                .catch(err => {
                                    reject(err);
                                });
                        }
                    });
                });
            });

            return Promise.all(aPromises)
                .then((licenciasProcesadas) => {
                    const results = licenciasProcesadas.filter(x => x !== null);

                    if (!results.length) {
                        oLicencesModel.setData([]);
                        Utils.onCountItems(oView, []);
                        return;
                    }

                    const turnosOriginales = {};
                    aResults.forEach(item => {
                        if (item.Id && item.Turno) {
                            turnosOriginales[item.Id] = item.Turno;
                        }
                    });

                    results.forEach(item => {
                        if (item.Timbeg && typeof item.Timbeg === 'object' && 'ms' in item.Timbeg) {
                            const totalMinutes = Math.floor(item.Timbeg.ms / (1000 * 60));
                            item.InitHourSort = totalMinutes;
                        }
                        else if (item.Timbeg && typeof item.Timbeg === 'string' && item.Timbeg !== "PT00H00M00S") {
                            const hoursMatch = item.Timbeg.match(/(\d+)H/);
                            const minutesMatch = item.Timbeg.match(/(\d+)M/);

                            const hours = hoursMatch ? parseInt(hoursMatch[1], 10) : 0;
                            const minutes = minutesMatch ? parseInt(minutesMatch[1], 10) : 0;

                            item.InitHourSort = hours * 60 + minutes;
                        }
                        else if (item.Gdate) {
                            const d = new Date(item.Gdate);
                            item.InitHourSort = d.getHours() * 60 + d.getMinutes();
                        } else {
                            item.InitHourSort = null;
                        }
                    });

                    const arrayOrdenado = TurnosService.encontrarGrupo(
                        TurnosService.ordenarPorEqunr(results),
                        oView
                    );

                    TurnosService.assignShiftsToLicences(arrayOrdenado);

                    const aEquiposConEstacion = arrayOrdenado
                        .map(item => {
                            const oCombo = {
                                Equnr: (item.Equnr || "").trim(),
                                Tplnr: (item.Tplnr || "").trim()
                            };
                            return oCombo;
                        })
                        .filter(item => {
                            const bTieneAmbos = item.Equnr && item.Tplnr;
                            return bTieneAmbos;
                        });

                    const aEquiposUnicos = Array.from(
                        new Map(aEquiposConEstacion.map(item => [JSON.stringify(item), item])).values()
                    );

                    return this._obtenerDescripcionesEquipos(aEquiposUnicos)
                        .then((oDescripcionesEquipos) => {

                            arrayOrdenado.forEach(item => {
                                const sEquipoNormalizado = (item.Equnr || "").trim();
                                item.DescEquipo = oDescripcionesEquipos[sEquipoNormalizado] || "";
                                item.EquipoCompleto = item.DescEquipo ? item.Equnr + " - " + item.DescEquipo : item.Equnr;
                            });

                            const oDatePicker = this.byId("date");
                            const oFechaTurno = oDatePicker && oDatePicker.getDateValue();

                            const bIsEditable = this._isEditableTurno(oFechaTurno);

                            arrayOrdenado.forEach((item, index) => {
                                item.isEditable = bIsEditable;

                                if (turnosOriginales[item.Id]) {
                                    item.TurnoAsignado = turnosOriginales[item.Id];
                                }

                                if (item.tramitacionPorFecha && oFechaTurno) {
                                    const colorEspecifico = this._getTramitacionColorPorFecha(item, oFechaTurno);
                                    item.tramitacionColorFecha = colorEspecifico;
                                } else {
                                    item.tramitacionColorFecha = null;
                                }
                            });

                            arrayOrdenado.forEach(item => {
                                const iconoColor = item.tramitacionColorFecha === 'red' ? '🔴' :
                                    item.tramitacionColorFecha === 'yellow' ? '🟡' : '⚪';
                            });

                            this._rebuildFrontendGroupsByEquipoHora(arrayOrdenado);
                            this._assignGroupColors(arrayOrdenado);

                            // Ordenar por consola y luego por hora dentro de cada consola
                            this._sortLicences(arrayOrdenado);

                            oLicencesModel.setData(arrayOrdenado);
                            Utils.onCountItems(oView, arrayOrdenado);

                            //CLONAR Y AGREGAR DESCRIPCIONES TAMBIÉN AL CLON
                            const arrayClonado = JSON.parse(JSON.stringify(arrayOrdenado));
                            arrayClonado.forEach(item => {
                                item.isEditable = bIsEditable;
                            });

                            // Modelo que usa la tabla cronológica
                            const oListCronoModel = new JSONModel(arrayClonado);
                            oView.setModel(oListCronoModel, "listCronoModel");

                            // Transformar datos para TreeTable
                            const aTreeData = TreeTableHelper.transformToTreeStructure(arrayClonado);

                            function preserveNodeData(nodes) {
                                nodes.forEach(node => {
                                    // Preservar tramitación
                                    if (!node.tramitacionColorFecha && node.Id) {
                                        const original = arrayClonado.find(item => item.Id === node.Id);
                                        if (original && original.tramitacionColorFecha) {
                                            node.tramitacionColorFecha = original.tramitacionColorFecha;
                                        }
                                    }

                                    // Preservar descripciones de equipo para nodos grupo
                                    if (node._isGroup && node.Equnr) {
                                        const original = arrayClonado.find(item => item.Equnr === node.Equnr);
                                        if (original) {
                                            node.DescEquipo = original.DescEquipo || "";
                                            node.EquipoCompleto = original.EquipoCompleto || node.Equnr;
                                        }
                                    }

                                    // Recursivo para hijos
                                    if (node.children && node.children.length > 0) {
                                        preserveNodeData(node.children);
                                    }
                                });
                            }
                            preserveNodeData(aTreeData);

                            const oTreeModel = ModelHelper.getModel("listCronoTreeModel", oView);
                            oTreeModel.setData(aTreeData);
                            oTreeModel.refresh();

                            function sortByTurnoAsignado(a, b) {
                                const toMinutes = (hora) => {
                                    if (!hora) return 0;
                                    const [h, m] = hora.split(":").map(Number);
                                    return h * 60 + m;
                                };

                                return toMinutes(a.TurnoAsignado) - toMinutes(b.TurnoAsignado);
                            }

                            this._loadAttachmentsForLicensesAsync(arrayOrdenado)
                                .then(() => {
                                })
                                .catch((error) => {
                                    console.error("Error al cargar adjuntos:", error);
                                });

                            this._checkUnassignedLicenses(oFechaTurno);
                            this._updateEditableState();
                        });
                })
                .catch((error) => {
                    oLicencesModel.setData([]);
                });
        },

        // POR SI FALLA ESTE BUSCARIA EN SERIE NO EN PARALELO COMO EL PROMISE.ALL
        // successSelectTurno: async function (data) {
        //     const oView = this.getView()
        //     const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
        //     const oDataModel = this.getView().getModel();

        //     try {
        //         const aResults = Array.isArray(data?.results) ? data.results : [];

        //         if (!aResults.length) {
        //             oLicencesModel.setData([]);
        //             Utils.onCountItems(this,[]);
        //             return;
        //         }

        //         // Buscar una licencia por vez (sin Promise.all)
        //         const results = [];
        //         for (const licencia of aResults) {
        //             try {
        //                 const licData = await LicenseService.FIND(licencia, oDataModel);
        //                 results.push(licData);
        //             } catch (err) {
        //                 // Si querés seguir aunque falle una licencia:
        //                 console.error("Error en FIND para licencia", licencia, err);
        //                 // Si en vez de seguir querés cortar, podés hacer: throw err;
        //             }
        //         }

        //         if (!results.length) {
        //             oLicencesModel.setData([]);
        //             Utils.onCountItems(this,[]);
        //             return;
        //         }

        //         // Procesar lógica de negocio
        //         const arrayOrdenado = TurnosService.encontrarGrupo(
        //             TurnosService.ordenarPorEqunr(results), this.getView()
        //         );

        //         TurnosService.assignShiftsToLicences(arrayOrdenado);

        //         console.log(oLicencesModel)

        //         oLicencesModel.setData(arrayOrdenado);


        //         Utils.onCountItems(this,arrayOrdenado);

        //     } catch (error) {
        //         console.error("Error en successSelectTurno:", error);
        //         oLicencesModel.setData([]);
        //         Utils.onCountItems(this,[]);

        //     }
        // },

        onChangeHour: function (oEvent) {
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            const oSource = oEvent.getSource();
            const sPath = oSource.getBindingContext("LicencesJsonModel").getPath();
            const iLicenseIndex = parseInt(sPath.split("/")[1], 10);

            const oModel = this.getView().getModel("LicencesJsonModel");
            const aLicences = oModel.getProperty("/");
            const sNewTime = oEvent.getParameter("value");
            const oSelectedLicence = aLicences[iLicenseIndex];

            // Validación: rango prohibido 5:30 - 6:30
            if (this._isTimeInRestrictedRange(sNewTime)) {
                MessageBox.error(
                    oResourceBundle.getText("invalidShiftTimeRange"),
                    {
                        title: oResourceBundle.getText("validationError"),
                        onClose: function () {
                            oSource.setValue("");
                            oSource.setValueState(CoreLibrary.ValueState.Error);
                            oSource.setValueStateText(oResourceBundle.getText("invalidShiftTimeRange"));

                            this._updateSameGroupAndConsoleShifts(aLicences, oSelectedLicence, "");

                            this._rebuildFrontendGroupsByEquipoHora(aLicences);

                            // ordenar y refrescar el modelo completo
                            this._sortLicences(aLicences);
                            oModel.setProperty("/", aLicences);
                            oModel.refresh(true);
                        }
                    }
                );
                return;
            }

            oSource.setValueState(CoreLibrary.ValueState.None);
            oSource.setValueStateText("");

            // Solo actualizar licencia individual
            this._updateSameGroupAndConsoleShifts(aLicences, oSelectedLicence, sNewTime);
            this._rebuildFrontendGroupsByEquipoHora(aLicences);
            this._assignGroupColors(aLicences);

            this._sortLicences(aLicences);

            const iNewIndex = aLicences.findIndex(function (lic) {
                return lic === oSelectedLicence;
            });

            this._cascadeGroupsDown(aLicences, iNewIndex, oSource);

            this._rebuildFrontendGroupsByEquipoHora(aLicences);
            this._assignGroupColors(aLicences);

            oModel.setProperty("/", aLicences);
            oModel.refresh(true);
        },


        _updateSameGroupAndConsoleShifts: function (aLicences, oSelectedLicence, sNewTime) {
            // Recorre las licencias y actualiza el horario solo de aquellas que comparten el mismo Grupo y Consola
            aLicences.forEach(function (oLicence) {
                if (oLicence.Consola === oSelectedLicence.Consola && oLicence.Grupo === oSelectedLicence.Grupo) {
                    oLicence.TurnoAsignado = sNewTime;
                }
            });
        },
        _sortLicences: function (aLicences) {

            // Agrupamos por Consola + Grupo
            var groupsByConsola = {};

            aLicences.forEach(function (lic, index) {
                var consola = lic.Consola || "";
                var grupo = lic.Grupo || lic.Equnr || "";

                if (!groupsByConsola[consola]) {
                    groupsByConsola[consola] = {};
                }
                if (!groupsByConsola[consola][grupo]) {
                    groupsByConsola[consola][grupo] = {
                        consola: consola,
                        grupo: grupo,
                        items: [],
                        firstIndex: index
                    };
                }

                groupsByConsola[consola][grupo].items.push(lic);
                if (index < groupsByConsola[consola][grupo].firstIndex) {
                    groupsByConsola[consola][grupo].firstIndex = index;
                }
            }.bind(this));

            var result = [];

            // Ordenamos por Consola y dentro de cada consola por hora de grupo
            Object.keys(groupsByConsola).sort().forEach(function (consola) {
                var groupsMap = groupsByConsola[consola];
                var groups = Object.keys(groupsMap).map(function (k) {
                    return groupsMap[k];
                });

                // calcular hora de inicio del grupo
                groups.forEach(function (g) {
                    var firstWithTurno = g.items.find(function (it) { return !!it.TurnoAsignado; });
                    if (firstWithTurno) {
                        g.hasTurno = true;
                        g.startMinutes = this._convertShiftToMinutes(firstWithTurno.TurnoAsignado);
                    } else {
                        g.hasTurno = false;
                        g.startMinutes = Number.MAX_SAFE_INTEGER;
                    }
                }.bind(this));

                // primero grupos con turno, ordenados por hora, luego sin turno por orden original
                groups.sort(function (a, b) {
                    if (a.hasTurno && !b.hasTurno) return -1;
                    if (!a.hasTurno && b.hasTurno) return 1;
                    if (!a.hasTurno && !b.hasTurno) {
                        return a.firstIndex - b.firstIndex;
                    }

                    if (a.startMinutes !== b.startMinutes) {
                        return a.startMinutes - b.startMinutes;
                    }
                    return a.firstIndex - b.firstIndex;
                });

                // aplanar
                groups.forEach(function (g) {
                    g.items.forEach(function (lic) {
                        result.push(lic);
                    });
                });
            }.bind(this));

            // Reemplazamos el contenido del array original
            aLicences.length = 0;
            Array.prototype.push.apply(aLicences, result);
        },


        _convertShiftToMinutes: function (shift) {
            const [hours, minutes] = shift.split(":").map(Number);
            return hours * 60 + minutes;
        },

        onDeletePress: function (oEvent) {
            const oTable = this.getView().byId("turnosTable");

            // Intentar obtener índice del contexto del menú (clic derecho)
            let aIndicesToDelete = [];

            if (oEvent && oEvent.getSource) {
                const oMenuItem = oEvent.getSource();
                const oContextMenu = oMenuItem.getParent();

                // Si viene del menú contextual, obtener la fila del binding context
                if (oContextMenu && oContextMenu.getBindingContext("LicencesJsonModel")) {
                    const sPath = oContextMenu.getBindingContext("LicencesJsonModel").getPath();
                    const iIndex = parseInt(sPath.split("/").pop());

                    if (!isNaN(iIndex)) {
                        aIndicesToDelete = [iIndex];
                    }
                }
            }

            if (aIndicesToDelete.length === 0) {
                const aSelectedIndices = oTable.getSelectedIndices();

                if (!aSelectedIndices || aSelectedIndices.length === 0) {
                    MessageToast.show("Por favor, seleccione al menos una fila para eliminar.");
                    return;
                }

                aIndicesToDelete = aSelectedIndices;
            }

            // Tomar fecha del turno (para la key Dateturno)
            const oDatePicker = this.byId("date");
            const oFechaTurno = oDatePicker && oDatePicker.getDateValue();

            if (!oFechaTurno) {
                MessageBox.warning("Debe seleccionar una fecha de turno para poder eliminar.");
                return;
            }

            //  Obtener modelo local
            const oJsonModel = this.getView().getModel("LicencesJsonModel");
            let aLicenses = oJsonModel.getProperty("/") || [];

            if (!Array.isArray(aLicenses) || aLicenses.length === 0) {
                MessageToast.show("No hay datos para eliminar.");
                return;
            }

            //  Ordenar índices de mayor a menor para eliminar sin problemas
            const aSortedIndices = aIndicesToDelete.slice().sort(function (a, b) {
                return b - a;
            });

            const aDataToDelete = [];

            // Armar payload para backend y eliminar del modelo local
            aSortedIndices.forEach(function (index) {
                if (index >= 0 && index < aLicenses.length) {
                    const oRowData = aLicenses[index];

                    // Armo objeto clave para el OData
                    aDataToDelete.push({
                        Id: oRowData.Id,
                        Empresa: oRowData.Empresa,
                        Tipo: oRowData.Tipo || "L",
                        Anio: oRowData.Anio,
                        Dateturno: oFechaTurno     // JS Date usado como key
                    });

                    // Eliminar del array local
                    aLicenses.splice(index, 1);
                }
            });

            if (aDataToDelete.length === 0) {
                MessageToast.show("No se encontraron filas válidas para eliminar.");
                return;
            }

            // 🔹 Actualizar modelo local y limpiar selección
            oJsonModel.setProperty("/", aLicenses);
            oJsonModel.refresh(true);
            oTable.clearSelection();

            // 🔹 Llamar al backend para eliminar en TurnosLicenciasSet
            const oDataService = this.getView().getModel();
            const entity = "/TurnosLicenciasSet";

            const aDeletePromises = aDataToDelete.map((item) => {
                return new Promise((resolve, reject) => {
                    const sKeyPath = oDataService.createKey(entity, {
                        Id: item.Id,
                        Empresa: item.Empresa,
                        Tipo: item.Tipo,
                        Anio: item.Anio,
                        Dateturno: item.Dateturno
                    });

                    oDataService.remove("/" + sKeyPath, {
                        success: () => {
                            resolve();
                        },
                        error: (oError) => {
                            reject(oError);
                        }
                    });
                });
            });

            Promise.all(aDeletePromises)
                .then(() => {
                    Utils.onCountItems(this.getView(), aLicenses);
                    const iCount = aDataToDelete.length;
                    const sMsg = iCount === 1
                        ? "Se ha eliminado 1 licencia."
                        : "Se han eliminado " + iCount + " licencias.";
                    MessageToast.show(sMsg);
                })
                .catch((error) => {
                    MessageBox.error("Ocurrió un error al eliminar en backend.");
                });
        },


        onDetachLicense: function (oEvent) {
            var oTable = this.byId("turnosTable");
            var iSelectedIndex = -1;

            if (oEvent && oEvent.getSource) {
                const oMenuItem = oEvent.getSource();
                const oContextMenu = oMenuItem.getParent();

                if (oContextMenu && oContextMenu.getBindingContext("LicencesJsonModel")) {
                    const sPath = oContextMenu.getBindingContext("LicencesJsonModel").getPath();
                    iSelectedIndex = parseInt(sPath.split("/").pop());

                    if (!isNaN(iSelectedIndex)) {
                    } else {
                        iSelectedIndex = -1;
                    }
                }
            }

            if (iSelectedIndex === -1) {
                iSelectedIndex = oTable.getSelectedIndex();

                if (iSelectedIndex === -1) {
                    MessageToast.show("Por favor, seleccione una fila para desacoplar.");
                    return;
                }
            }

            var oModel = this.getView().getModel("LicencesJsonModel");
            var aLicences = oModel.getData();

            // Check if the model data is available and the index is valid
            if (!oModel || !aLicences || iSelectedIndex < 0 || iSelectedIndex >= aLicences.length) {
                MessageToast.show("Datos no válidos.");
                return;
            }

            // Detach the selected license
            var oDetachedLicense = aLicences.splice(iSelectedIndex, 1)[0];
            var groupConsola = oDetachedLicense.Consola;  // Get the Consola value (group identifier)

            // Find the last item in the same group
            var groupLastIndex = -1;
            for (var i = aLicences.length - 1; i >= 0; i--) {
                if (aLicences[i].Consola === groupConsola) {
                    groupLastIndex = i;
                    break;
                }
            }

            if (groupLastIndex === -1) {
                MessageToast.show("No se encontró el grupo de la licencia.");
                return;
            }

            // Get the last license in the group to calculate the new time 
            var oLastLicenseInGroup = aLicences[groupLastIndex];
            var currentTime = this._convertShiftToMinutes(oLastLicenseInGroup.TurnoAsignado);
            const shiftInfo = Utils.getShiftInfo(oDetachedLicense);
            const shiftDuration = shiftInfo.duration;

            currentTime += shiftDuration;
            oDetachedLicense.TurnoAsignado = this._formatTime(currentTime);

            // Assign a unique group for the detached license
            oDetachedLicense.Grupo = "_Desacoplado_" + oDetachedLicense.Id;

            // Insert the detached license after the last element of the group
            aLicences.splice(groupLastIndex + 1, 0, oDetachedLicense);

            this._rebuildFrontendGroupsByEquipoHora(aLicences);
            this._assignGroupColors(aLicences);

            // Update the model
            oModel.setProperty("/", aLicences);
            oModel.refresh(true);

            // Clear selection in the table
            oTable.clearSelection();

            // Notify the user
            MessageToast.show("Licencia desacoplada, asignada después del último elemento del grupo con nuevo turno y grupo individual.");
        },

        _formatTime: function (iMinutes) {
            // Convertir los minutos de nuevo a formato HH:mm
            var iHours = Math.floor(iMinutes / 60);
            var iRemainderMinutes = iMinutes % 60;

            // Asegurarse de que siempre tenga 2 dígitos
            return (iHours < 10 ? "0" : "") + iHours + ":" + (iRemainderMinutes < 10 ? "0" : "") + iRemainderMinutes;
        },
        onAddLicense: function () {
            this.onSelectLicense()
                .then(function () {
                    this.openDialog("transener.sistemadeturnos.fragments.addLicenses");
                }.bind(this));
        },
        onSelectLicense: function () {
            const oSearchModel = ModelHelper.getModel("SearchLicense", this.getView());
            this.getView().setModel(oSearchModel, "SearchLicense");

            var dateTurno = this.byId('date');

            const FechaTurno = dateTurno.getDateValue()


            return TurnosService.search({ FechaTurno, oView: this.getView(), isRefresh: true })
                .then((resultadoFinal) => {

                    // 1) Tomamos las licencias ya agregadas
                    const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());
                    const aLicenciasExistentes = oLicencesModel?.getData() || [];

                    // 2) Armamos un Set con los Id ya existentes
                    const idsExistentes = new Set(
                        aLicenciasExistentes.map((l) => l.Id)   // 🔁 CAMBIAR "Id" por tu campo real (p.ej. "IdLicencia")
                    );

                    // 3) Nos quedamos SOLO con las nuevas
                    const aNuevas = resultadoFinal.filter(item =>
                        !idsExistentes.has(item.Id)             // 🔁 mismo campo que arriba
                    );

                    // 4) Guardamos SOLO las nuevas en el modelo de búsqueda
                    oSearchModel.setData(aNuevas);
                    oSearchModel.refresh();


                })
                .catch((error) => {
                    oSearchModel.setData([]);
                    oSearchModel.refresh();
                });
        },
        showGlobalBusy: function (sText) {
            var oView = this.getView();

            if (!this._pBusyDialog) {
                this._pBusyDialog = Fragment.load({
                    id: oView.getId(), // 👈 MUY IMPORTANTE
                    name: "transener.sistemadeturnos.fragments.BusyDialog",
                    controller: this
                }).then(function (oDialog) {
                    oView.addDependent(oDialog);
                    return oDialog;
                });
            }

            this._pBusyDialog.then(function (oDialog) {
                // Ahora this.byId sí ve el Text del fragment
                var oLabel = this.byId("busyLabel");
                if (oLabel) {
                    oLabel.setText(sText || "");
                }
                oDialog.open();
            }.bind(this));
        },

        hideGlobalBusy: function () {
            if (this._pBusyDialog) {
                this._pBusyDialog.then(function (oDialog) {
                    oDialog.close();
                });
            }
        },
        openDialog: function (fragment) {
            var oView = this.getView();

            // Si ya había un diálogo, lo destruyo
            if (oDialog) {
                oDialog.destroy();
                oDialog = null;
            }

            Fragment.load({
                id: oView.getId(),
                name: fragment,
                controller: this,
            }).then(function (oFragment) {
                oDialog = oFragment;

                // Lo cuelgo de la vista
                oView.addDependent(oDialog);

                var oSearchLicenseModel = oView.getModel("SearchLicense");
                if (oSearchLicenseModel) {
                    oDialog.setModel(oSearchLicenseModel, "SearchLicense");
                }

                oDialog.open();
            }.bind(this));
        },


        closeDialog: function () {
            if (oDialog) {
                oDialog.close();
            }
        },

        onPressAdd: function () {
            var oTable = this.byId("idLicensesTable");
            var aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageBox.warning("Debe seleccionar al menos un elemento.");
                return;
            }

            // Datos seleccionados desde SearchLicense
            var aSelectedData = aSelectedItems.map(oItem =>
                oItem.getBindingContext("SearchLicense").getObject()
            );

            // Modelo actual que ya contiene turnos asignados
            var oLicencesModel = this.getView().getModel("LicencesJsonModel");
            var aCurrentData = oLicencesModel.getProperty("/") || [];

            // Filtrar los que ya existen (según tu regla de Id)
            var aNewData = aSelectedData.filter(item =>
                !aCurrentData.some(existing => existing.Id === item.Id)
            );

            if (aNewData.length === 0) {
                MessageBox.information("Los elementos seleccionados ya están en la lista.");
                return;
            }

            const oDatePicker = this.byId("date");
            const oFechaTurno = oDatePicker && oDatePicker.getDateValue();
            const bIsEditable = this._isEditableTurno(oFechaTurno);

            aNewData.forEach(item => {
                item.isEditable = bIsEditable;
            });

            // Extraer combinaciones únicas de Equnr + Tplnr
            const aEquiposUnicos = aNewData
                .map(item => ({
                    Equnr: (item.Equnr || "").trim(),
                    Tplnr: (item.Tplnr || "").trim()
                }))
                .filter(item => item.Equnr && item.Tplnr);

            // Eliminar duplicados
            const aEquiposUnicosDedup = Array.from(
                new Map(aEquiposUnicos.map(item => [JSON.stringify(item), item])).values()
            );

            if (aEquiposUnicosDedup.length === 0) {
                TurnosService.appendLicencesToModel(aNewData, this.getView());
                MessageBox.success("Se han agregado " + aNewData.length + " elementos correctamente.");
                return;
            }

            // Obtener descripciones
            this._obtenerDescripcionesEquipos(aEquiposUnicosDedup)
                .then((oDescripcionesEquipos) => {

                    aNewData.forEach(item => {
                        const sEquipoNormalizado = (item.Equnr || "").trim();
                        item.DescEquipo = oDescripcionesEquipos[sEquipoNormalizado] || "";
                        item.EquipoCompleto = item.DescEquipo
                            ? item.Equnr + " - " + item.DescEquipo
                            : item.Equnr;
                    });

                    TurnosService.appendLicencesToModel(aNewData, this.getView());
                    MessageBox.success("Se han agregado " + aNewData.length + " elementos correctamente.");
                })
                .catch((error) => {
                    TurnosService.appendLicencesToModel(aNewData, this.getView());
                    MessageBox.success("Se han agregado " + aNewData.length + " elementos correctamente.");
                });
        },

        // ==================== CÓDIGO CORREGIDO - POPOVER COMBO ====================

        onOpenAccionesMultiplePopover: function (oEvent) {
            var oButton = oEvent.getSource();
            var oView = this.getView();

            this._oRowContext = oButton.getBindingContext("LicencesJsonModel");
            if (!this._oRowContext) {
                sap.m.MessageToast.show("No se pudo obtener el contexto de la fila.");
                return;
            }

            var oModel = oView.getModel("LicencesJsonModel");
            var sPath = this._oRowContext.getPath();
            var aAccionesEntregas = oModel.getProperty(sPath + "/accionesEntregas");

            if (!Array.isArray(aAccionesEntregas)) {
                aAccionesEntregas = [];
                oModel.setProperty(sPath + "/accionesEntregas", aAccionesEntregas);
            }

            if (this._oComboPopover) {
                this._oComboPopover.destroy();
                this._oComboPopover = null;
            }

            Fragment.load({
                id: oView.getId(),
                name: "transener.sistemadeturnos.fragments.ComboPopover",
                controller: this
            }).then(function (oPopover) {
                this._oComboPopover = oPopover;
                oView.addDependent(oPopover);

                const oCell = oButton.getParent();

                this._initializeCheckBoxes(aAccionesEntregas);

                oPopover.openBy(oCell);
            }.bind(this));
        },

        _initializeCheckBoxes: function (aAccionesEntregas) {
            var aCheckBoxes = [
                { id: "checkboxSOL_COC", key: "SOL COC" },
                { id: "checkboxSOL_TEC", key: "SOL TEC" },
                { id: "checkboxAUT_COC", key: "AUT COC" }
            ];

            var aNombres = (Array.isArray(aAccionesEntregas) ? aAccionesEntregas : [])
                .map(function (e) { return e && e.nombre; })
                .filter(Boolean);

            aCheckBoxes.forEach(function (oCb) {
                var oControl = this.byId(oCb.id);

                if (oControl) {
                    var bSelected = aNombres.indexOf(oCb.key) !== -1;
                    oControl.setSelected(bSelected);
                }
            }.bind(this));
        },

        onClosePopover: function () {
            if (this._oComboPopover) {
                this._oComboPopover.close();
            }
            this._oRowContext = null;
        },

        onCheckBoxSelect: function (oEvent) {
            var oCheckBox = oEvent.getSource();

            var aCustomData = oCheckBox.getCustomData();
            var sKey = null;

            if (aCustomData && aCustomData.length > 0) {
                for (var i = 0; i < aCustomData.length; i++) {
                    if (aCustomData[i].getKey() === "key") {
                        sKey = aCustomData[i].getValue();
                        break;
                    }
                }
            }

            if (!sKey) {
                return;
            }

            if (!this._oRowContext) {
                sap.m.MessageToast.show("No se pudo obtener el contexto de la fila.");
                return;
            }

            var oModel = this.getView().getModel("LicencesJsonModel");
            var sPath = this._oRowContext.getPath();
            var aAccionesEntregas = oModel.getProperty(sPath + "/accionesEntregas") || [];

            if (oCheckBox.getSelected()) {
                var bExiste = aAccionesEntregas.some(function (oEntry) {
                    return oEntry && oEntry.nombre === sKey;
                });

                if (!bExiste) {
                    aAccionesEntregas.push({
                        nombre: sKey,
                        descripcion: "Descripción para " + sKey
                    });
                }
            } else {
                aAccionesEntregas = aAccionesEntregas.filter(function (oEntry) {
                    return oEntry && oEntry.nombre !== sKey;
                });
            }

            oModel.setProperty(sPath + "/accionesEntregas", aAccionesEntregas);
        },

        formatCheckBoxSelected: function (aAccionesEntregas, sCheckBoxKey) {
            return aAccionesEntregas && aAccionesEntregas.some(function (oEntry) {
                return oEntry.nombre === sCheckBoxKey;
            });
        },


        // --------------------------- POP UP CONSOLA ------------

        onSaveTurnoPress: function () {
            let Fecha = this._oFechaTurnoCreado || this.getView().byId('date').getDateValue();

            if (!RoleHelper.isEditor()) {
                MessageBox.error("No tenés permisos para realizar esta acción");
                return;
            }

            if (!Fecha) {
                MessageBox.warning("Debe seleccionar una fecha para guardar el turno.");
                return;
            }

            const oModel = this.getView().getModel("LicencesJsonModel");
            const aAllLicences = oModel.getProperty("/") || [];

            if (!aAllLicences || aAllLicences.length === 0) {
                MessageBox.warning("No hay datos para guardar.");
                return;
            }

            aAllLicences.forEach((lic, idx) => {
                if (lic.Attachments && lic.Attachments.length > 0) {
                    lic.Attachments.forEach((att, attIdx) => {
                        console.log(`   📎 Adjunto ${attIdx + 1}:`, {
                            AttachmentName: att.AttachmentName,
                            TieneAttindex: !!att.Attindex,
                            AttachmentType: att.AttachmentType,
                            AttachmentSize: att.AttachmentSize
                        });
                    });
                }
            });

            // VALIDACIÓN: Verificar que todas las licencias tengan horario asignado
            const aLicenciasSinHorario = aAllLicences.filter(lic => {
                const turno = lic.TurnoAsignado;
                return !turno || turno.trim() === "";
            });

            if (aLicenciasSinHorario.length > 0) {
                const sLicenciasDetalle = aLicenciasSinHorario
                    .map(lic => `• Licencia ${lic.Id} (${lic.Equnr || 'Sin equipo'})`)
                    .join("\n");

                MessageBox.error(
                    `No se puede guardar el turno porque hay ${aLicenciasSinHorario.length} licencia(s) sin horario asignado:\n\n${sLicenciasDetalle}\n\nPor favor, asigne un horario a todas las licencias antes de guardar.`,
                    {
                        title: "Horarios sin asignar",
                        styleClass: "sapUiSizeCompact"
                    }
                );
                return;
            }

            this._checkNewLicensesBeforeSave(Fecha)
                .then((bContinue) => {
                    if (!bContinue) {
                        return;
                    }

                    const aData = [];

                    aAllLicences.forEach(function (oRowData) {
                        const row = {
                            Id: oRowData.Id,
                            Empresa: oRowData.Empresa,
                            Tipo: oRowData.Tipo,
                            Anio: oRowData.Anio,
                            Fecha: Fecha,
                            Turno: oRowData.TurnoAsignado,
                            Comentarios: oRowData.Comentarios,
                            Enviado: false,
                            Agrmanual: oRowData.Agrmanual || false
                        };

                        aData.push(row);
                    });

                    this.createTurno(aData, aAllLicences, false);
                })
                .catch((error) => {
                    const aData = [];

                    aAllLicences.forEach(function (oRowData) {
                        const row = {
                            Id: oRowData.Id,
                            Empresa: oRowData.Empresa,
                            Tipo: oRowData.Tipo,
                            Anio: oRowData.Anio,
                            Fecha: Fecha,
                            Turno: oRowData.TurnoAsignado,
                            Comentarios: oRowData.Comentarios,
                            Enviado: false,
                            Agrmanual: oRowData.Agrmanual || false
                        };

                        aData.push(row);
                    });

                    this.createTurno(aData, aAllLicences, false);
                });
        },

        createTurno: function (licencias, aAttachments, bEnviado) {
            const entity = "/TurnosLicenciasSet";
            const oDataService = this.getView().getModel();
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            const sMensajeBusy = bEnviado ? "Enviando turno..." : "Guardando cambios...";
            this.showGlobalBusy(sMensajeBusy);

            const aPromises = licencias.map((licencia) => {
                return new Promise((resolve, reject) => {
                    const license = {
                        "Id": licencia.Id,
                        "Empresa": licencia.Empresa,
                        "Tipo": licencia.Tipo || "L",
                        "Anio": licencia.Anio,
                        "Dateturno": new Date(licencia.Fecha),
                        "Turno": licencia.Turno,
                        "Comentarios": licencia.Comentarios,
                        "Enviado": bEnviado !== undefined ? bEnviado : licencia.Enviado,
                        "Agrmanual": licencia.Agrmanual || false
                    };

                    oDataService.create(entity, license, {
                        success: () => resolve(),
                        error: (oError) => {
                            reject(oError);
                        }
                    });
                });
            });

            Promise.all(aPromises)
                .then(() => {

                    const sMensajeExito = bEnviado
                        ? "Turno enviado exitosamente"
                        : "Cambios guardados correctamente";
                    MessageToast.show(sMensajeExito);
                    this._suppressLicenseAlert = true;

                    if (licencias && licencias.length > 0) {
                        this._saveAttachments(licencias)
                            .then(() => {
                                this._recargarDatosDespuesDeGuardar();
                            });
                    } else {
                        this._recargarDatosDespuesDeGuardar();
                    }
                })
                .catch((error) => {
                    this.hideGlobalBusy();
                    MessageBox.error("Error al guardar los turnos");
                });
        },

        _recargarDatosDespuesDeGuardar: function () {
            const oView = this.getView();
            const oDataService = this.getView().getModel();
            const oDatePicker = this.byId("date");
            const oFechaTurno = oDatePicker && oDatePicker.getDateValue();

            if (!oFechaTurno) {
                this.hideGlobalBusy();
                return;
            }

            const aFilters = [
                new Filter("Dateturno", FilterOperator.EQ, oFechaTurno),
                new Filter("Empresa", FilterOperator.EQ, "100")
            ];

            const sEntity = "/TurnosLicenciasSet";
            oDataService.read(sEntity, {
                filters: aFilters,
                success: (oData) => {
                    const aResults = oData?.results || [];

                    if (aResults.length === 0) {
                        this.hideGlobalBusy();
                        MessageToast.show("Turno guardado correctamente");
                        return;
                    }

                    this.successSelectTurno(oData)
                        .then(() => {
                            setTimeout(() => {
                                this.hideGlobalBusy();
                                MessageToast.show("Turno guardado y actualizado correctamente");
                            }, 500);
                        })
                        .catch((err) => {
                            this.hideGlobalBusy();
                        });
                },
                error: (oError) => {
                    this.hideGlobalBusy();
                    MessageToast.show("Turno guardado (no se pudo recargar automáticamente)");
                }
            });
        },

        /* createTurno: function (licencias, aAttachments) {
            const entity = "/TurnosLicenciasSet";
            const oDataService = this.getView().getModel();
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            const sMensajeBusy = bEnviado ? "Enviando turno..." : "Guardando cambios...";
            this.showGlobalBusy(sMensajeBusy);

            const sMensajeExito = bEnviado
                ? "Turno enviado exitosamente"
                : "Cambios guardados correctamente";
            MessageToast.show(sMensajeExito);

            const aPromises = licencias.map((licencia) => {
                return new Promise((resolve, reject) => {
                    const license = {
                        "Id": licencia.Id,
                        "Empresa": licencia.Empresa,
                        "Tipo": licencia.Tipo || "L",
                        "Anio": licencia.Anio,
                        "Dateturno": new Date(licencia.Fecha),
                        "Turno": licencia.Turno,
                        "Comentarios": licencia.Comentarios
                    };

                    oDataService.create(entity, license, {
                        success: () => resolve(),
                        error: (oError) => {
                            console.error("Error al crear turno:", oError);
                            reject(oError);
                        }
                    });
                });
            });

            Promise.all(aPromises)
                .then(() => {
                    MessageToast.show(oResourceBundle.getText("saveTurno") + " - Éxito");

                    if (aAttachments && aAttachments.length > 0) {
                        this._saveAttachments(aAttachments);
                    }

                    setTimeout(() => {
                        this._recargarDatosDespuesDeGuardar();
                    }, 1000);
                })
                .catch((error) => {
                    this.hideGlobalBusy();
                    MessageBox.error("Error al guardar los turnos");
                    console.error(error);
                });
        }, */

        // ------------ FILTROS AVANZADOS ----------------------------------
        openAdvancedFilters: function () {
            const oView = this.getView();
            const oFiltersModel = ModelHelper.getModel("FiltersJsonModel", oView);
            const oHardCodeModel = ModelHelper.getModel("HardCodeModel", oView);
            const PersonalHabilitadoModel = ModelHelper.getModel("PersonalHabilitadoModel", oView);
            const oRepModel = ModelHelper.getModel("RepositionTimes", oView);
            const oSelectModel = ModelHelper.getModel("SelectModel", oView);
            const society = this.society;

            // Carga servicios
            TipoEquipoService.loadTipoEquipo(society, oView);
            InterventionTypesService.getPromise(oView);

            // Si el diálogo no existe
            if (!this.advancedFilters) {

                Fragment.load({
                    id: oView.getId(),
                    name: "transener.sistemadeturnos.fragments.advancedFilters",
                    controller: this
                }).then((oDialogContent) => {

                    const oDialog = new sap.m.Dialog({
                        title: "Filtros Avanzados",
                        contentWidth: "60%",
                        modal: true,
                        content: oDialogContent,
                        buttons: [
                            new sap.m.Button({
                                text: "Cancelar",
                                icon: "sap-icon://decline",
                                press: () => this.closeAdvancedFilters()
                            }).addStyleClass("buttonInverted floatLeft"),

                            new sap.m.Button({
                                text: "Limpiar",
                                icon: "sap-icon://document",
                                press: () => this.clearAdvancedFilters()
                            }).addStyleClass("buttonInverted floatLeft"),

                            new sap.m.Button({
                                text: "Aplicar",
                                icon: "sap-icon://search",
                                press: () => this.makeFilters()
                            }).addStyleClass("buttonInverted floatRight")
                        ]
                    }).addStyleClass("customDialog");

                    // Set models
                    oDialog.setModel(ModelHelper.getModel("WorkPlacesJsonModel", oView), "WorkPlacesJsonModel");
                    oDialog.setModel(oView.getModel("GrupoPlanificador"), "GrupoPlanificador");
                    oDialog.setModel(ModelHelper.getModel("TiposIntervencion", oView), "TiposIntervencion");
                    oDialog.setModel(ModelHelper.getModel("TipoEquipoJsonModel", oView), "TipoEquipoJsonModel");
                    oDialog.setModel(oSelectModel, "SelectModel");
                    oDialog.setModel(oFiltersModel, "FiltersJsonModel");
                    oDialog.setModel(oHardCodeModel, "HardCodeModel");
                    oDialog.setModel(PersonalHabilitadoModel, "PersonalHabilitadoModel");
                    oDialog.setModel(oRepModel, "RepositionTimes");
                    oDialog.setModel(ModelHelper.getModel("TipoLicFiltersModel", oView), "TipoLicFiltersModel");
                    oDialog.setModel(ModelHelper.getModel("CheckAdvancedFiltersModel", oView), "CheckAdvancedFiltersModel");

                    this.advancedFilters = oDialog;
                    this.advancedFilters.open();
                });

            } else {
                // Si ya existe
                this.advancedFilters.setModel(PersonalHabilitadoModel, "PersonalHabilitadoModel");
                this.advancedFilters.setModel(oSelectModel, "SelectModel");
                this.advancedFilters.setModel(oHardCodeModel, "HardCodeModel");
                this.advancedFilters.setModel(oFiltersModel, "FiltersJsonModel");
                this.advancedFilters.setModel(oRepModel, "RepositionTimes");
                this.advancedFilters.setModel(oView.getModel("RepositionTimes"), "RepositionTimes");
                this.advancedFilters.setModel(ModelHelper.getModel("WorkPlacesJsonModel", oView), "WorkPlacesJsonModel");
                this.advancedFilters.setModel(oView.getModel("GrupoPlanificador"), "GrupoPlanificador");
                this.advancedFilters.setModel(ModelHelper.getModel("TipoLicFiltersModel", oView), "TipoLicFiltersModel");
                this.advancedFilters.setModel(ModelHelper.getModel("CheckAdvancedFiltersModel", oView), "CheckAdvancedFiltersModel");
                this.advancedFilters.open();
            }
        },

        closeAdvancedFilters: function () {
            if (this.advancedFilters) {
                this.advancedFilters.close();
            }
        },

        clearAdvancedFilters: function () {
            const oView = this.getView();

            // Resetear el modelo de filtros a sus valores por defecto
            const oFiltersModel = ModelHelper.getModel("FiltersJsonModel", oView);
            const sPath = sap.ui.require.toUrl("transener/sistemadeturnos/model/FiltersJsonModel.json");
            oFiltersModel.loadData(sPath, "", false);

            // Resetear el modelo de filtros locales
            const oLocalFiltersModel = ModelHelper.getModel("LocalFilterJsonModel", oView);
            oLocalFiltersModel.setData({});

            // Resetear checkboxes de filtros avanzados
            const oCheckModel = ModelHelper.getModel("CheckAdvancedFiltersModel", oView);
            oCheckModel.setData({
                Aro: false,
                Bloqueo: false,
                Rdisparo: false
            });

            MessageToast.show("Filtros limpiados");
        },

        makeFilters: function () {
            const oView = this.getView();
            const oDatePicker = this.byId("date");
            const oSelectedDate = oDatePicker.getDateValue();

            if (!oSelectedDate) {
                MessageBox.warning("Por favor seleccione una fecha primero");
                return;
            }

            // Cerrar el diálogo de filtros avanzados si está abierto
            this.closeAdvancedFilters();

            // Ver qué filtros están activos
            const oFiltersModel = ModelHelper.getModel("FiltersJsonModel", oView);
            const oFilters = oFiltersModel.getData();

            for (const key in oFilters) {
                const filter = oFilters[key];
                if (filter.value !== null && filter.value !== undefined && filter.value !== "" &&
                    (Array.isArray(filter.value) ? filter.value.length > 0 : true)) {
                }
            }

            const aBackendFilters = [
                new Filter("Empresa", FilterOperator.EQ, "100"),
                new Filter("Dateturno", FilterOperator.EQ, oSelectedDate)
            ];

            this.showGlobalBusy("Cargando turnos...");

            const oDataService = oView.getModel();

            oDataService.read("/TurnosLicenciasSet", {
                filters: aBackendFilters,
                success: (oData) => {

                    if (oData.results.length === 0) {
                        this.successSelectTurno({ results: [] });
                        this.hideGlobalBusy();
                        MessageToast.show("No hay turnos para esta fecha");
                        return;
                    }

                    let loadedCount = 0;
                    let errorCount = 0;

                    const aPromises = oData.results.map((turno, index) => {
                        return new Promise((resolve) => {
                            const sLicenciaPath = `/LicenciaTrabajoSet(Empresa='${turno.Empresa}',Id='${turno.Id}',Tipo='${turno.Tipo}',Anio='${turno.Anio}')`;

                            oDataService.read(sLicenciaPath, {
                                success: (oLicencia) => {
                                    turno.LicenciaTrabajo = oLicencia;
                                    loadedCount++;
                                    resolve(turno);
                                },
                                error: (oError) => {
                                    errorCount++;
                                    resolve(turno);
                                }
                            });
                        });
                    });

                    Promise.all(aPromises).then((aTurnosWithLicencias) => {
                        if (errorCount > 0) console.warn(`  - Errores al cargar: ${errorCount}`);

                        const withLicencia = aTurnosWithLicencias.filter(t => t.LicenciaTrabajo).length;

                        const aFiltered = this._applyAdvancedFiltersInMemory(aTurnosWithLicencias);
                        this.successSelectTurno({ results: aFiltered })
                            .then(() => {
                                const message = aFiltered.length === aTurnosWithLicencias.length
                                    ? `Mostrando turnos`
                                    : `Filtros aplicados`;
                                MessageToast.show(message);
                            })
                            .catch((err) => {
                            })
                            .finally(() => {
                                this.hideGlobalBusy();
                            });
                    });
                },
                error: (oError) => {
                    const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
                    oLicencesModel.setData([]);
                    Utils.onCountItems(oView, []);
                    this.hideGlobalBusy();
                    MessageBox.error("Error al cargar turnos");
                }
            });
        },

        //FILTROS AVANZADOS - REGIONES
        _loadRegiones: function () {
            const oView = this.getView();
            const oRegionesModel = ModelHelper.getModel("RegionesJsonModel", oView);

            const oModel = this.getOwnerComponent().getModel();

            if (!oModel) {
                oRegionesModel.setData({
                    Regiones: [
                        { Werks: "102", Name1: "Transener - Reg Centro Este", Bukrs: "100" },
                        { Werks: "103", Name1: "Transener - Reg Norte", Bukrs: "100" },
                        { Werks: "104", Name1: "Transener - Reg Sur", Bukrs: "100" },
                        { Werks: "120", Name1: "ARO Transener", Bukrs: "100" }
                    ]
                });
                return;
            }

            const aFilters = [
                new sap.ui.model.Filter("Bukrs", sap.ui.model.FilterOperator.EQ, "100")
            ];

            oModel.read("/RegionesSet", {
                filters: aFilters,
                success: (oData) => {
                    oRegionesModel.setData({ Regiones: oData.results });
                },
                error: (oError) => {
                    oRegionesModel.setData({
                        Regiones: [
                            { Werks: "102", Name1: "Transener - Reg Centro Este", Bukrs: "100" },
                            { Werks: "103", Name1: "Transener - Reg Norte", Bukrs: "100" },
                            { Werks: "104", Name1: "Transener - Reg Sur", Bukrs: "100" },
                            { Werks: "120", Name1: "ARO Transener", Bukrs: "100" }
                        ]
                    });
                }
            });
        },

        _loadEstaciones: function () {
            const oModel = this.getOwnerComponent().getModel();
            const oEstacionesModel = ModelHelper.getModel("EstacionesJsonModel", this.getView());

            if (!oModel) {
                oEstacionesModel.setData({ Estaciones: [] });
                return;
            }

            oModel.read("/EstacionesRolesSet", {
                success: (oData) => {
                    const aEstaciones = oData.results.sort((a, b) => a.Codigo.localeCompare(b.Codigo));
                    oEstacionesModel.setData({ Estaciones: aEstaciones });
                },
                error: () => {
                    oEstacionesModel.setData({ Estaciones: [] });
                }
            });
        },

        _loadPuestosTrabajo: function () {
            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel();
            const oWorkPlacesModel = ModelHelper.getModel("WorkPlacesJsonModel", oView);

            if (!oModel) {
                oWorkPlacesModel.setData({ WorkPlaces: [], FilteredWorkPlaces: [] });
                return;
            }

            oModel.read("/PuestoTrabajoSet", {
                success: (oData) => {
                    const aWerksTransener = ["102", "103", "104", "120"];
                    const aTransenerOnly = oData.results.filter(oWP => {
                        return aWerksTransener.includes(oWP.Werks);
                    });

                    const aPorRegion = aTransenerOnly.reduce((acc, oWP) => {
                        acc[oWP.Werks] = (acc[oWP.Werks] || 0) + 1;
                        return acc;
                    }, {});

                    const aWorkPlaces = aTransenerOnly.sort((a, b) => {
                        return (a.Ktext || "").localeCompare(b.Ktext || "");
                    });

                    console.groupEnd();

                    oWorkPlacesModel.setData({
                        WorkPlaces: aWorkPlaces,
                        FilteredWorkPlaces: aWorkPlaces
                    });
                },
                error: (oError) => {
                    console.groupEnd();

                    oWorkPlacesModel.setData({ WorkPlaces: [], FilteredWorkPlaces: [] });
                }
            });
        },

        _loadTipoEquipo: function () {
            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel();
            const oTipoEquipoModel = ModelHelper.getModel("TipoEquipoJsonModel", oView);
            const society = this.society;

            if (!oModel) {
                oTipoEquipoModel.setData({ TipoEquipo: [] });
                return;
            }

            const aFilters = [];
            if (society && society !== "null") {
                aFilters.push(new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, society));
            }

            oModel.read("/NSTipoEquipoSet", {
                filters: aFilters.length > 0 ? aFilters : undefined,
                success: (oData) => {
                    const aTipoEquipo = oData.results.sort((a, b) => {
                        return (a.Descripcion || "").localeCompare(b.Descripcion || "");
                    });

                    oTipoEquipoModel.setData({ TipoEquipo: aTipoEquipo });
                },
                error: (oError) => {
                    oTipoEquipoModel.setData({ TipoEquipo: [] });
                }
            });
        },

        _loadRepositionTimes: function () {
            const oModel = this.getOwnerComponent().getModel();
            const oRepositionTimesModel = ModelHelper.getModel("RepositionTimes", this.getView());

            if (!oModel) {
                oRepositionTimesModel.setData({ RepositionTimes: [] });
                return;
            }

            const aFilters = [
                new sap.ui.model.Filter("Tabname", sap.ui.model.FilterOperator.EQ, "ZTAB_LICENCIAS"),
                new sap.ui.model.Filter("Fieldname", sap.ui.model.FilterOperator.EQ, "TIEMPOREP")
            ];

            oModel.read("/FixedValuesSet", {
                filters: aFilters,
                success: (oData) => {
                    oRepositionTimesModel.setData({ RepositionTimes: oData.results });
                },
                error: () => {
                    oRepositionTimesModel.setData({ RepositionTimes: [] });
                }
            });
        },

        _loadPersonalHabilitado: function () {
            const oView = this.getView();
            const oModel = this.getOwnerComponent().getModel();
            const oPersonalModel = ModelHelper.getModel("PersonalHabilitadoModel", oView);
            const sEmpresa = this.society || "100";

            if (!oModel) {
                oPersonalModel.setData({
                    Solicitante: [],
                    JefeDeTrabajo: []
                });
                return;
            }

            Promise.all([
                this._getSolicitantesPromise(oModel, sEmpresa),
                this._getJefesTrabajoPromise(oModel, sEmpresa)
            ]).then(([aSolicitantes, aJefes]) => {

                aSolicitantes.sort((a, b) => (a.Nombre || "").localeCompare(b.Nombre || ""));
                aJefes.sort((a, b) => (a.Nombre || "").localeCompare(b.Nombre || ""));

                console.groupEnd();

                oPersonalModel.setData({
                    Solicitante: aSolicitantes,
                    JefeDeTrabajo: aJefes
                });

            }).catch((error) => {
                oPersonalModel.setData({
                    Solicitante: [],
                    JefeDeTrabajo: []
                });
                console.groupEnd();
            });
        },

        _getSolicitantesPromise: function (oModel, sEmpresa) {
            return new Promise((resolve, reject) => {

                const aFilters = [
                    new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, sEmpresa),
                    new sap.ui.model.Filter("TipoHab", sap.ui.model.FilterOperator.EQ, "SO")
                ];

                oModel.read("/PersonalHabilitadoSet", {
                    filters: aFilters,
                    success: (oData) => {
                        resolve(oData.results);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },

        _getJefesTrabajoPromise: function (oModel, sEmpresa) {
            return new Promise((resolve, reject) => {

                const aFilters = [
                    new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, sEmpresa),
                    new sap.ui.model.Filter("TipoHab", sap.ui.model.FilterOperator.EQ, "JT"),
                    new sap.ui.model.Filter("ClaseHab", sap.ui.model.FilterOperator.EQ, "H0001")
                ];

                oModel.read("/PersonalHabilitadoSet", {
                    filters: aFilters,
                    success: (oData) => {
                        resolve(oData.results);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },

        _applyAdvancedFiltersInMemory: function (aData) {
            const oView = this.getView();
            const oFilters = ModelHelper.getModel("FiltersJsonModel", oView).getData();

            const DEBUG = true;
            const MAX_SAMPLES = 10;

            const stats = {
                total: aData.length,
                withLicencia: 0,
                included: 0,
                excluded: 0,
                reasons: {},
                samples: []
            };

            const norm = (v) => String(v ?? "").trim();
            const normUpper = (v) => norm(v).toUpperCase();

            const isActive = (f) => {
                if (!f) return false;
                const v = f.value;
                if (Array.isArray(v)) return v.length > 0;
                return v !== null && v !== undefined && String(v) !== "";
            };

            const licVal = (lic, key) => lic?.[key] ?? lic?.[key.toLowerCase()] ?? lic?.[key.toUpperCase()];

            const pushReason = (id, field, expected, actual, lic) => {
                stats.reasons[field] = (stats.reasons[field] || 0) + 1;
                if (DEBUG && stats.samples.length < MAX_SAMPLES) {
                    stats.samples.push({
                        id,
                        reason: field,
                        expected,
                        actual,
                        licSnapshot: {
                            R500kv: licVal(lic, "R500kv"),
                            Barrafs: licVal(lic, "Barrafs"),
                            Aro: licVal(lic, "Aro"),
                            Bloqueo: licVal(lic, "Bloqueo"),
                            Period: licVal(lic, "Period"),
                            Tiemporep: licVal(lic, "Tiemporep"),
                            Tipinterv: licVal(lic, "Tipinterv"),
                            Tipolicencia: licVal(lic, "Tipolicencia"),
                            Equstatnocam: licVal(lic, "Equstatnocam"),
                            Equstat: licVal(lic, "Equstat"),
                            Rdisparo: licVal(lic, "Rdisparo")
                        }
                    });
                }
            };

            const checkEQ = (id, lic, fieldName, expectedRaw, actualRaw, normalizeFn = norm) => {
                const expected = normalizeFn(expectedRaw);
                const actual = normalizeFn(actualRaw);
                if (expected === "") return true;

                if (actual === expected) return true;

                pushReason(id, fieldName, expected, actual, lic);
                return false;
            };

            const aFiltered = [];

            aData.forEach((item, index) => {
                const id = item.Id || `registro-${index}`;
                const lic = item.LicenciaTrabajo;

                if (!lic) {
                    pushReason(id, "SinLicenciaTrabajo", "(licencia requerida)", "(null/undefined)", {});
                    return;
                }
                stats.withLicencia++;

                // Arbpl
                if (isActive(oFilters.Arbpl) && !checkEQ(id, lic, "Arbpl", oFilters.Arbpl.value, licVal(lic, "Arbpl"), norm)) return;

                // Period
                if (isActive(oFilters.Period) && !checkEQ(id, lic, "Period", oFilters.Period.value, licVal(lic, "Period"), norm)) return;

                // Solicitante
                if (isActive(oFilters.Solicitante) && !checkEQ(id, lic, "Solicitante", oFilters.Solicitante.value, licVal(lic, "Solicitante"), norm)) return;

                // Tipoequipo
                if (isActive(oFilters.Tipoequipo) && !checkEQ(id, lic, "Tipoequipo", oFilters.Tipoequipo.value, licVal(lic, "Tipoequipo"), norm)) return;

                // R500kv (N/X)
                if (isActive(oFilters.R500kv) && !checkEQ(id, lic, "R500kv", oFilters.R500kv.value, licVal(lic, "R500kv"), normUpper)) return;

                // Barrafs (N/X)
                if (isActive(oFilters.Barrafs) && !checkEQ(id, lic, "Barrafs", oFilters.Barrafs.value, licVal(lic, "Barrafs"), normUpper)) return;

                // Tipinterv
                if (isActive(oFilters.Tipinterv) && !checkEQ(id, lic, "Tipinterv", oFilters.Tipinterv.value, licVal(lic, "Tipinterv"), norm)) return;

                // Tiemporep
                if (isActive(oFilters.Tiemporep) && !checkEQ(id, lic, "Tiemporep", oFilters.Tiemporep.value, licVal(lic, "Tiemporep"), norm)) return;

                // Tipolicencia
                if (isActive(oFilters.Tipolicencia) && !checkEQ(id, lic, "Tipolicencia", oFilters.Tipolicencia.value, licVal(lic, "Tipolicencia"), normUpper)) return;

                // SolSuplente
                if (isActive(oFilters.SolSuplente) && !checkEQ(id, lic, "SolSuplente", oFilters.SolSuplente.value, licVal(lic, "SolSuplente"), norm)) return;

                // Jobcond
                if (isActive(oFilters.Jobcond) && !checkEQ(id, lic, "Jobcond", oFilters.Jobcond.value, licVal(lic, "Jobcond"), norm)) return;

                // Jefe
                if (isActive(oFilters.Jefe) && !checkEQ(id, lic, "Jefe", oFilters.Jefe.value, licVal(lic, "Jefe"), norm)) return;

                // Aro (si viene vacío, se considera "todos")
                if (isActive(oFilters.Aro) && !checkEQ(id, lic, "Aro", oFilters.Aro.value, licVal(lic, "Aro"), normUpper)) return;

                // JefeSuplente
                if (isActive(oFilters.JefeSuplente) && !checkEQ(id, lic, "JefeSuplente", oFilters.JefeSuplente.value, licVal(lic, "JefeSuplente"), norm)) return;

                // Bloqueo (si viene vacío, se considera "todos")
                if (isActive(oFilters.Bloqueo) && !checkEQ(id, lic, "Bloqueo", oFilters.Bloqueo.value, licVal(lic, "Bloqueo"), normUpper)) return;

                // Equstatnocam (si viene vacío, se considera "todos")
                if (isActive(oFilters.Equstatnocam) && !checkEQ(id, lic, "Equstatnocam", oFilters.Equstatnocam.value, licVal(lic, "Equstatnocam"), normUpper)) return;

                // Rdisparo (si viene vacío, se considera "todos")
                if (isActive(oFilters.Rdisparo) && !checkEQ(id, lic, "Rdisparo", oFilters.Rdisparo.value, licVal(lic, "Rdisparo"), normUpper)) return;

                // SenalesC (array)
                if (isActive(oFilters.SenalesC)) {
                    const expectedSignals = oFilters.SenalesC.value;
                    const has = expectedSignals.some(s => {
                        switch (s) {
                            case "0": return normUpper(licVal(lic, "Senalestados")) === "X";
                            case "1": return normUpper(licVal(lic, "Senalalarmas")) === "X";
                            case "2": return normUpper(licVal(lic, "Senalmedicion")) === "X";
                            case "4": return normUpper(licVal(lic, "Senalninguna")) === "X";
                            default: return false;
                        }
                    });

                    if (!has) {
                        pushReason(id, "SenalesC", expectedSignals, {
                            Senalestados: licVal(lic, "Senalestados"),
                            Senalalarmas: licVal(lic, "Senalalarmas"),
                            Senalmedicion: licVal(lic, "Senalmedicion"),
                            Senalninguna: licVal(lic, "Senalninguna")
                        }, lic);
                        return;
                    }
                }

                // Si pasó todo:
                aFiltered.push(item);
                stats.included++;
            });

            stats.excluded = stats.total - stats.included;
            return aFiltered;
        },

        _acceptEmptyValues: function (sAttribute, oFilterConfig) {
            switch (sAttribute) {
                case "Equstatnocam":
                case "Equstat":
                case "Bloqueo":
                case "Rdisparo":
                    return true;
                default:
                    return oFilterConfig.value !== "" && oFilterConfig.value !== null;
            }
        },

        _getFilterObject: function (sAttribute, sValue) {
            const oObject = {};

            // Casos especiales para señales
            switch (sValue) {
                case "0":
                    oObject.attribute = "Senalestados";
                    oObject.value = "X";
                    break;
                case "1":
                    oObject.attribute = "Senalalarmas";
                    oObject.value = "X";
                    break;
                case "2":
                    oObject.attribute = "Senalmedicion";
                    oObject.value = "X";
                    break;
                case "3":
                    oObject.attribute = "Precauciones";
                    oObject.value = "X";
                    break;
                case "4":
                    oObject.attribute = "Senalninguna";
                    oObject.value = "X";
                    break;
                default:
                    oObject.attribute = sAttribute;
                    oObject.value = sValue;
                    break;
            }

            return oObject;
        },



        // ---------------------------------------------------------------
        _cascadeGroupsDown: function (aLicences, startIndex, oTimeControl) {

            var ValueState = CoreLibrary.ValueState;

            if (startIndex < 0 || startIndex >= aLicences.length) {
                return;
            }

            var baseLicence = aLicences[startIndex];
            var consola = baseLicence.Consola;

            if (!consola) {
                return;
            }

            // 1) Armamos grupos SOLO de esa consola
            var groupsMap = {};
            aLicences.forEach(function (lic, idx) {
                if (lic.Consola !== consola) return;

                var grupo = lic.Grupo || lic.Equnr || "";
                if (!groupsMap[grupo]) {
                    groupsMap[grupo] = {
                        grupo: grupo,
                        items: [],
                        firstIndex: idx
                    };
                }
                groupsMap[grupo].items.push(lic);
                if (idx < groupsMap[grupo].firstIndex) {
                    groupsMap[grupo].firstIndex = idx;
                }
            });

            var groups = Object.keys(groupsMap).map(function (k) {
                return groupsMap[k];
            });

            groups.sort(function (a, b) {
                return a.firstIndex - b.firstIndex;
            });

            var editedGroupIndex = groups.findIndex(function (g) {
                return g.items.indexOf(baseLicence) !== -1;
            });

            if (editedGroupIndex === -1) {
                return;
            }

            var upperWarning = false;

            var prevGroup = groups[editedGroupIndex];
            var firstWithTurno = prevGroup.items.find(function (it) { return !!it.TurnoAsignado; });

            if (!firstWithTurno) {
                return;
            }

            // VALIDAR contra el grupo anterior
            if (editedGroupIndex > 0) {
                var upperGroup = groups[editedGroupIndex - 1];
                var upperFirstWithTurno = upperGroup.items.find(function (it) { return !!it.TurnoAsignado; });

                if (upperFirstWithTurno) {
                    var upperStart = this._convertShiftToMinutes(upperFirstWithTurno.TurnoAsignado);

                    var upperInfo = Utils.getShiftInfo(upperGroup.items[0]);
                    var minAllowedStart = upperStart + upperInfo.duration;

                    var newStart = this._convertShiftToMinutes(firstWithTurno.TurnoAsignado);

                    if (newStart < minAllowedStart) {
                        upperWarning = true;
                    }
                }
            }

            // CASCADA HACIA ABAJO
            var prevStart = this._convertShiftToMinutes(firstWithTurno.TurnoAsignado);
            var warnings = [];

            for (var i = editedGroupIndex + 1; i < groups.length; i++) {
                var group = groups[i];

                var gFirstWithTurno = group.items.find(function (it) { return !!it.TurnoAsignado; });
                if (!gFirstWithTurno) {
                    continue;
                }

                var prevInfo = Utils.getShiftInfo(prevGroup.items[0]);
                var expectedStart = prevStart + prevInfo.duration;
                var currentStart = this._convertShiftToMinutes(gFirstWithTurno.TurnoAsignado);

                if (expectedStart < currentStart) {
                    warnings.push(group);
                    prevGroup = group;
                    prevStart = currentStart;
                    continue;
                }

                var newTimeStr = this._formatTime(expectedStart);
                group.items.forEach(function (it) {
                    it.TurnoAsignado = newTimeStr;
                });

                prevGroup = group;
                prevStart = expectedStart;
            }

            // Mensajes
            if (upperWarning && warnings.length > 0) {
                MessageToast.show("El turno comienza antes de la separación mínima y algunos grupos no se ajustaron para evitar adelantar turnos.");
            } else if (upperWarning) {
                MessageToast.show("El turno comienza antes de la separación mínima con el grupo anterior.");
            } else if (warnings.length > 0) {
                MessageToast.show("Algunos grupos no se ajustaron para evitar adelantar turnos.");
            }

            // VALUE STATE
            if (oTimeControl) {
                if (upperWarning) {
                    oTimeControl.setValueState(ValueState.Error);
                    oTimeControl.setValueStateText("El turno comienza antes de la separación mínima con el grupo anterior.");
                } else {
                    oTimeControl.setValueState(ValueState.None);
                    oTimeControl.setValueStateText("");
                }
            }
        },

        // ==================== MÉTODOS PARA ADJUNTAR ARCHIVOS PDF ====================

        onAttachFile: function (oEvent) {
            this._currentAttachmentContext = oEvent.getSource().getBindingContext("LicencesJsonModel");

            if (!this._currentAttachmentContext) {
                MessageToast.show("No se pudo obtener la licencia");
                return;
            }

            const oLicencia = this._currentAttachmentContext.getObject();

            // Crear input de archivo si no existe
            if (!this._fileInput) {
                this._fileInput = document.createElement("input");
                this._fileInput.type = "file";
                this._fileInput.accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt";
                this._fileInput.style.display = "none";

                this._fileInput.addEventListener("change", function (e) {
                    this._handleFileSelection(e);
                }.bind(this));

                document.body.appendChild(this._fileInput);
            }

            this._fileInput.value = null;
            this._fileInput.click();
        },

        _handleFileSelection: function (oEvent) {

            const file = oEvent.target.files[0];

            if (!file) {
                return;
            }

            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                MessageBox.error("El archivo es demasiado grande. Máximo 10MB");
                return;
            }

            // Convertir a base64
            this._convertFileToBase64(file);
        },

        _convertFileToBase64: function (file) {
            const reader = new FileReader();

            reader.onload = function (e) {
                const base64String = e.target.result;

                if (this._currentAttachmentContext) {
                    const oLicencia = this._currentAttachmentContext.getObject();

                    if (!oLicencia.Attachments) {
                        oLicencia.Attachments = [];
                    }

                    // Obtener fecha del turno
                    const oFechaTurno = this._oFechaTurnoCreado || this.byId("date").getDateValue();

                    const nuevoAdjunto = {
                        // Keys
                        Id: oLicencia.Id,
                        Empresa: "100",
                        Tipo: "L",
                        Anio: new Date().getFullYear().toString(),
                        Dateturno: oFechaTurno,
                        Codigo: "",

                        // Campos adicionales
                        Accion: "",
                        Descripcion: oLicencia.Comments || "",
                        Equnr: (oLicencia.Equnr || "").substring(0, 18),
                        Comments: file.name.substring(0, 255),
                        Licstat: (oLicencia.Licstat || "01").substring(0, 2),
                        Attachment: base64String.split(',')[1],

                        // Metadata para UI (NO se envían al backend)
                        AttachmentName: file.name,
                        AttachmentSize: file.size,
                        AttachmentType: file.type,
                        Timestamp: new Date().getTime()
                    };

                    oLicencia.Attachments.push(nuevoAdjunto);

                    const oModel = this.getView().getModel("LicencesJsonModel");
                    oModel.refresh(true);

                    MessageToast.show("Archivo agregado: " + file.name);
                }
            }.bind(this);

            reader.onerror = function () {
                MessageBox.error("Error al leer el archivo");
            };

            reader.readAsDataURL(file);
        },

        onViewAttachment: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("LicencesJsonModel");

            if (!oContext) {
                MessageToast.show("No se pudo obtener la licencia");
                return;
            }

            const oLicencia = oContext.getObject();

            // Verificar si hay adjuntos
            if (!oLicencia.Attachments || oLicencia.Attachments.length === 0) {
                MessageToast.show("No hay archivos adjuntos");
                return;
            }

            this._showAttachmentSelector(oLicencia, oContext);
        },

        _showAttachmentSelector: function (oLicencia, oContext) {
            const oView = this.getView();

            // Guardar el contexto para eliminar
            this._currentAttachmentContext = oContext;
            this._currentLicenciaForAttachments = oLicencia;

            // Destruir diálogo anterior si existe
            if (this._attachmentSelectorDialog) {
                this._attachmentSelectorDialog.destroy();
                this._attachmentSelectorDialog = null;
            }

            const oList = new sap.m.List({
                mode: "None",
                items: {
                    path: "/attachments",
                    template: new sap.m.CustomListItem({
                        content: [
                            new sap.m.HBox({
                                justifyContent: "SpaceBetween",
                                alignItems: "Center",
                                items: [
                                    new sap.m.HBox({
                                        justifyContent: "End",
                                        alignItems: "Center",
                                        items: [
                                            new sap.ui.core.Icon({
                                                src: "{icon}",
                                                size: "2rem",
                                                color: "#0854a0"
                                            }).addStyleClass("sapUiSmallMarginEnd"),
                                            new sap.m.VBox({
                                                items: [
                                                    new sap.m.Text({
                                                        text: "{name}",
                                                        maxLines: 1
                                                    }).addStyleClass("sapUiSmallMarginBottom"),
                                                    new sap.m.Text({
                                                        text: "{info}",
                                                        maxLines: 1
                                                    }).addStyleClass("sapUiTinyText")
                                                ]
                                            })
                                        ]
                                    }),
                                    // Botones de acción
                                    new sap.m.HBox({
                                        justifyContent: "End",
                                        alignItems: "Center",
                                        items: [
                                            // Botón Ver
                                            new sap.m.Button({
                                                icon: "sap-icon://show",
                                                type: "Emphasized",
                                                tooltip: "Ver archivo",
                                                press: function (oEvent) {
                                                    const oItem = oEvent.getSource().getParent().getParent().getParent();
                                                    const iIndex = oList.indexOfItem(oItem);
                                                    const oAttachment = oLicencia.Attachments[iIndex];
                                                    this._openAttachment(oAttachment);
                                                }.bind(this)
                                            }).addStyleClass("sapUiTinyMarginEnd"),
                                            // Botón Eliminar
                                            new sap.m.Button({
                                                icon: "sap-icon://delete",
                                                type: "Reject",
                                                tooltip: "Eliminar archivo",
                                                press: function (oEvent) {
                                                    const oItem = oEvent.getSource().getParent().getParent().getParent();
                                                    const iIndex = oList.indexOfItem(oItem);
                                                    const oAttachment = oLicencia.Attachments[iIndex];
                                                    this._deleteAttachmentFromList(oAttachment, iIndex);
                                                }.bind(this)
                                            })
                                        ]
                                    })
                                ]
                            }).addStyleClass("sapUiSmallMargin")
                        ]
                    })
                }
            });

            const aListData = oLicencia.Attachments.map((att, idx) => ({
                name: att.AttachmentName,
                info: this._formatSize(att.AttachmentSize) + " • " + this._getFileTypeName(att.AttachmentType),
                icon: this.getFileIcon(att.AttachmentType),
                index: idx
            }));

            const oDialogModel = new sap.ui.model.json.JSONModel({
                attachments: aListData
            });

            this._attachmentSelectorDialog = new sap.m.Dialog({
                title: "Archivos Adjuntos - Licencia " + oLicencia.Id,
                contentWidth: "750px",
                contentHeight: "400px",
                content: [oList],
                beginButton: new sap.m.Button({
                    text: "Cerrar",
                    press: function () {
                        this._attachmentSelectorDialog.close();
                    }.bind(this)
                }),
                afterClose: function () {
                    this._attachmentSelectorDialog.destroy();
                    this._attachmentSelectorDialog = null;
                }.bind(this)
            });

            // Establecer modelo
            this._attachmentSelectorDialog.setModel(oDialogModel);

            // Agregar a la vista
            oView.addDependent(this._attachmentSelectorDialog);

            // Abrir
            this._attachmentSelectorDialog.open();
        },

        _deleteAttachmentFromList: function (oAttachment, iIndex) {
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            MessageBox.confirm(
                "¿Desea eliminar el archivo '" + oAttachment.AttachmentName + "'?",
                {
                    title: "Confirmar eliminación",
                    actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.DELETE,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.DELETE) {
                            this._deleteAttachment(oAttachment, iIndex);
                        }
                    }.bind(this)
                }
            );
        },

        _deleteAttachment: function (oAttachment, iIndex) {
            const oLicencia = this._currentLicenciaForAttachments;

            if (!oLicencia || !oLicencia.Attachments) {
                MessageToast.show("Error: No se pudo encontrar la licencia");
                return;
            }

            // Eliminar del array
            oLicencia.Attachments.splice(iIndex, 1);

            const oModel = this.getView().getModel("LicencesJsonModel");
            oModel.updateBindings(true);

            if (oAttachment.Attindex) {
                this._deleteAttachmentFromBackend(oAttachment);
            } else {
                MessageToast.show("Archivo eliminado: " + oAttachment.AttachmentName);
            }

            if (this._attachmentSelectorDialog) {
                this._attachmentSelectorDialog.close();
            }

            if (oLicencia.Attachments.length === 0) {
                MessageToast.show("Todos los archivos fueron eliminados");
            }
        },

        // ==================== FIN SOLUCIÓN BOTÓN ELIMINAR ====================

        /**
         * Formatea el tamaño del archivo
         */
        _formatSize: function (iSize) {
            if (!iSize) return "Desconocido";

            if (iSize < 1024) {
                return iSize + " B";
            } else if (iSize < 1024 * 1024) {
                return (iSize / 1024).toFixed(2) + " KB";
            } else {
                return (iSize / (1024 * 1024)).toFixed(2) + " MB";
            }
        },

        /**
         * Abre un adjunto seleccionado desde la lista
         */
        onSelectAttachmentFromList: function (oEvent) {
            const oItem = oEvent.getParameter("listItem");
            const oAttachment = oItem.getBindingContext("attachmentSelector").getObject();

            this._openAttachment(oAttachment);
            this._attachmentSelectorDialog.close();
        },

        /**
         * Abre un archivo adjunto (PDF, imagen, etc)
         */
        _openAttachment: function (oAttachment) {
            const sType = oAttachment.AttachmentType;

            // Para PDFs
            if (sType === "application/pdf") {
                this._openPDFViewer(oAttachment.AttachmentData);
                return;
            }

            // Para imágenes
            if (sType.startsWith("image/")) {
                this._openImageViewer(oAttachment);
                return;
            }

            // Para otros archivos, descargar
            this._downloadFile(oAttachment);
        },

        /**
         * Abre el visor de PDF
         */
        _openPDFViewer: function (base64Data) {
            const oView = this.getView();

            if (!this._pdfViewerDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "transener.sistemadeturnos.fragments.PDFViewer",
                    controller: this
                }).then(function (oDialog) {
                    this._pdfViewerDialog = oDialog;
                    oView.addDependent(oDialog);
                    this._setPDFContent(base64Data);
                    oDialog.open();
                }.bind(this));
            } else {
                this._setPDFContent(base64Data);
                this._pdfViewerDialog.open();
            }
        },

        _setPDFContent: function (base64Data) {
            const oHTMLControl = this.byId("pdfViewerContent");
            if (oHTMLControl) {
                const sHTMLContent =
                    '<embed src="' + base64Data + '" ' +
                    'type="application/pdf" ' +
                    'width="100%" ' +
                    'height="600px" ' +
                    'style="border: none;">' +
                    '</embed>';
                oHTMLControl.setContent(sHTMLContent);
            }
        },

        onAcceptPDFViewer: function () {
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            MessageToast.show(oResourceBundle.getText("pdfViewedSuccess"));
            this._pdfViewerDialog.close();
        },

        onClosePDFViewer: function () {
            this._pdfViewerDialog.close();
        },

        onDownloadFromViewer: function () {
            if (this._currentPDFData) {
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

                const link = document.createElement("a");
                link.href = this._currentPDFData.data;
                link.download = this._currentPDFData.name;

                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                MessageToast.show(oResourceBundle.getText("downloadingFile", [this._currentPDFData.name]));
            }
        },

        /**
         * Abre un visor simple de imágenes
         */
        _openImageViewer: function (oAttachment) {
            if (!this._imageDialog) {
                this._imageDialog = new sap.m.Dialog({
                    title: "Vista de Imagen",
                    contentWidth: "80%",
                    contentHeight: "80%",
                    content: new sap.m.Image({
                        id: this.createId("imageViewer"),
                        densityAware: false
                    }),
                    endButton: new sap.m.Button({
                        text: "Cerrar",
                        press: function () {
                            this._imageDialog.close();
                        }.bind(this)
                    })
                });
                this.getView().addDependent(this._imageDialog);
            }

            const oImage = sap.ui.getCore().byId(this.createId("imageViewer"));
            oImage.setSrc(oAttachment.AttachmentData);

            this._imageDialog.open();
        },

        /**
         * Descarga un archivo
         */
        _downloadFile: function (oAttachment) {
            const link = document.createElement("a");
            link.href = oAttachment.AttachmentData;
            link.download = oAttachment.AttachmentName;
            link.click();

            MessageToast.show("Descargando: " + oAttachment.AttachmentName);
        },

        /**
         * Elimina un adjunto específico de la licencia
         */
        onDeleteSpecificAttachment: function (oEvent) {
            const oItem = oEvent.getSource();
            const oAttachment = oItem.getBindingContext("attachmentSelector").getObject();
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            MessageBox.confirm("¿Desea eliminar " + oAttachment.AttachmentName + "?", {
                title: "Confirmar eliminación",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        this._deleteAttachment(oAttachment);
                    }
                }.bind(this)
            });
        },

        /**
         * Elimina un adjunto del array
         */
        _deleteAttachment: function (oAttachment, iIndex) {
            const oLicencia = this._currentLicenciaForAttachments;

            if (!oLicencia || !oLicencia.Attachments) {
                MessageToast.show("Error: No se pudo encontrar la licencia");
                return;
            }

            // Eliminar del array
            oLicencia.Attachments.splice(iIndex, 1);

            // ✅ CORRECCIÓN 1: Forzar actualización del modelo
            const oModel = this.getView().getModel("LicencesJsonModel");
            oModel.updateBindings(true);  // Cambiado de refresh a updateBindings

            // Obtener la tabla y refrescarla
            const oTable = this.byId("turnosTable");
            if (oTable) {
                oTable.getBinding("rows").refresh();
            }

            // Si se guardó en backend, eliminarlo también
            if (oAttachment.Attindex) {
                this._deleteAttachmentFromBackend(oAttachment);
            } else {
                MessageToast.show("Archivo eliminado: " + oAttachment.AttachmentName);
            }

            // Cerrar el diálogo siempre (para forzar refresco visual)
            if (this._attachmentSelectorDialog) {
                this._attachmentSelectorDialog.close();
            }

            // Mensaje si se eliminaron todos
            if (oLicencia.Attachments.length === 0) {
                MessageToast.show("Todos los archivos fueron eliminados");
            }
        },


        openExcelViewer: function (oAttachment) {
            this._downloadFile(oAttachment);
            MessageToast.show("Descargando: " + oAttachment.AttachmentName);
        },


        // ==================== BACKEND DE ADJUNTOS ====================

        _loadAttachmentsForLicensesAsync: function (aLicencias) {

            const oDataModel = this.getView().getModel();
            const oLicencesModel = this.getView().getModel("LicencesJsonModel");

            const aPromises = aLicencias.map((licencia, idx) => {

                return new Promise((resolve, reject) => {
                    const aFilters = [
                        new Filter("Id", FilterOperator.EQ, licencia.Id),
                        new Filter("Empresa", FilterOperator.EQ, licencia.Empresa),
                        new Filter("Anio", FilterOperator.EQ, licencia.Anio)
                    ];

                    oDataModel.read("/AttachmentLicenciasSet", {
                        filters: aFilters,
                        success: function (oData) {

                            if (oData.results && oData.results.length > 0) {

                                const aAttachments = oData.results.map(att => ({
                                    Id: att.Id,
                                    Empresa: att.Empresa,
                                    Anio: att.Anio,
                                    AttachmentData: "data:" + att.Doctype + ";base64," + att.Attachment,
                                    AttachmentName: att.Filename,
                                    AttachmentType: att.Doctype,
                                    Attindex: att.Attindex,
                                    Timestamp: new Date().getTime() + Math.random()
                                }));

                                // Buscar índice real
                                const aLicenciasActuales = oLicencesModel.getData();

                                const iRealIndex = aLicenciasActuales.findIndex(lic =>
                                    lic.Id === licencia.Id &&
                                    lic.Empresa === licencia.Empresa &&
                                    lic.Anio === licencia.Anio
                                );

                                if (iRealIndex !== -1) {
                                    oLicencesModel.setProperty("/" + iRealIndex + "/Attachments", aAttachments);

                                    // Verificar que se asignó
                                    const licenciaActualizada = oLicencesModel.getProperty("/" + iRealIndex);
                                }
                            }
                            resolve();
                        }.bind(this),
                        error: function (oError) {
                            resolve();
                        }
                    });
                });
            });

            return Promise.all(aPromises).then(() => {
                oLicencesModel.updateBindings(true);

                const oTable = this.byId("turnosTable");
                if (oTable) {
                    oTable.getBinding("rows").refresh();
                }
            });
        },

        _saveAttachments: function (aLicencias) {
            const oDataService = this.getView().getModel();
            const aPromises = [];

            aLicencias.forEach((licencia, idx) => {

                if (licencia.Attachments && licencia.Attachments.length > 0) {
                    licencia.Attachments.forEach((attachment, attIdx) => {
                        if (!attachment.Attindex) {

                            const promise = new Promise((resolve, reject) => {
                                let base64Data = attachment.AttachmentData;
                                if (base64Data.includes(",")) {
                                    base64Data = base64Data.split(",")[1];
                                }

                                const oAttachment = {
                                    "Id": attachment.Id,
                                    "Empresa": attachment.Empresa,
                                    "Anio": attachment.Anio,
                                    "Attachment": base64Data,
                                    "Filename": attachment.AttachmentName,
                                    "Doctype": attachment.AttachmentType
                                };

                                oDataService.create("/AttachmentLicenciasSet", oAttachment, {
                                    success: function (oData) {
                                        attachment.Attindex = oData.Attindex;
                                        resolve();
                                    },
                                    error: function (oError) {
                                        reject(oError);
                                    }
                                });
                            });

                            aPromises.push(promise);
                        }
                    });
                }
            });

            if (aPromises.length === 0) {
                return Promise.resolve();
            }

            return Promise.all(aPromises)
                .then(() => {
                    MessageToast.show("Adjuntos guardados exitosamente");
                })
                .catch((error) => {
                    MessageBox.warning("Algunos adjuntos no se pudieron guardar");
                });
        },

        //Elimina un adjunto del backend

        _deleteAttachmentFromBackend: function (oAttachment) {
            const oDataModel = this.getView().getModel();

            this.showGlobalBusy("Eliminando archivo...");

            const sPath = oDataModel.createKey("/AttachmentLicenciasSet", {
                Id: oAttachment.Id,
                Empresa: oAttachment.Empresa,
                Anio: oAttachment.Anio,
                Attindex: oAttachment.Attindex
            });

            oDataModel.remove(sPath, {
                success: function () {
                    this.hideGlobalBusy();

                    const oModel = this.getView().getModel("LicencesJsonModel");
                    oModel.updateBindings(true);

                    const oTable = this.byId("turnosTable");
                    if (oTable) {
                        oTable.getBinding("rows").refresh();
                    }

                    MessageToast.show("Archivo eliminado correctamente");
                }.bind(this),
                error: function (oError) {
                    this.hideGlobalBusy();
                    MessageBox.error("Error al eliminar el archivo del servidor");
                }.bind(this)
            });
        },

        // ==================== FIN SECCIÓN DE ADJUNTOS ====================

        // ==================== HELPERS Y FORMATTERS PARA ADJUNTOS ====================

        formatAttachmentInfo: function (iSize, sType) {
            let sSize = "Desconocido";

            if (iSize) {
                if (iSize < 1024) {
                    sSize = iSize + " B";
                } else if (iSize < 1024 * 1024) {
                    sSize = (iSize / 1024).toFixed(2) + " KB";
                } else {
                    sSize = (iSize / (1024 * 1024)).toFixed(2) + " MB";
                }
            }

            const sTypeName = this._getFileTypeName(sType);

            return sSize + " • " + sTypeName;
        },

        _getFileTypeName: function (sType) {
            const mTypes = {
                "application/pdf": "PDF",
                "application/msword": "Word",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "Word",
                "application/vnd.ms-excel": "Excel",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "Excel",
                "image/jpeg": "Imagen JPEG",
                "image/jpg": "Imagen JPG",
                "image/png": "Imagen PNG",
                "text/plain": "Texto"
            };

            return mTypes[sType] || "Archivo";
        },

        getFileIcon: function (sType) {
            if (!sType) return "sap-icon://document";

            if (sType === "application/pdf") {
                return "sap-icon://pdf-attachment";
            }

            if (sType.startsWith("image/")) {
                return "sap-icon://image-viewer";
            }

            if (sType.includes("word")) {
                return "sap-icon://doc-attachment";
            }

            if (sType.includes("excel") || sType.includes("spreadsheet")) {
                return "sap-icon://excel-attachment";
            }

            if (sType === "text/plain") {
                return "sap-icon://document-text";
            }

            return "sap-icon://document";
        },

        hasAttachments: function (oLicencia) {
            return oLicencia &&
                oLicencia.Attachments &&
                oLicencia.Attachments.length > 0;
        },

        getAttachmentCount: function (oLicencia) {
            if (!oLicencia || !oLicencia.Attachments) {
                return 0;
            }
            return oLicencia.Attachments.length;
        },

        onCloseAttachmentSelector: function () {
            if (this._attachmentSelectorDialog) {
                this._attachmentSelectorDialog.close();
            }
        },

        // ==================== FIN HELPERS Y FORMATTERS ====================

        //----------------------------------------------------------------------------------

        onLicenseSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue")?.trim() || "";
            const oTable = this.byId("idLicensesTable");
            const oBinding = oTable.getBinding("items");

            if (!sQuery) {
                oBinding.filter([]);
                return;
            }

            const aFilters = [
                new sap.ui.model.Filter("Id", sap.ui.model.FilterOperator.Contains, sQuery),
                new sap.ui.model.Filter("Equnr", sap.ui.model.FilterOperator.Contains, sQuery),
                new sap.ui.model.Filter("Comments", sap.ui.model.FilterOperator.Contains, sQuery)
            ];

            const oOrFilter = new sap.ui.model.Filter({
                filters: aFilters,
                and: false  // OR
            });

            oBinding.filter([oOrFilter]);
        },

        onReportsPress: function (oEvent) {
            var oView = this.getView();
            var sReportType = "amplio"; // Por defecto
            var sDialogTitle = "Reporte Amplio";

            // Obtener el tipo de reporte desde el CustomData del MenuItem
            if (oEvent && oEvent.getSource) {
                var oMenuItem = oEvent.getSource();
                var aCustomData = oMenuItem.getCustomData();
                if (aCustomData && aCustomData.length > 0) {
                    for (var i = 0; i < aCustomData.length; i++) {
                        if (aCustomData[i].getKey() === "reportType") {
                            sReportType = aCustomData[i].getValue();
                            sDialogTitle = sReportType === "maniobras" ? "Resumen maniobras" : "Reporte Amplio";
                            break;
                        }
                    }
                }
            }

            // Si el diálogo no existe, lo creamos
            if (!this._oReportsDialog) {
                Fragment.load({
                    id: oView.getId(),
                    name: "transener.sistemadeturnos.fragments.reportsDialog",
                    controller: this
                }).then(function (oDialog) {
                    this._oReportsDialog = oDialog;
                    oView.addDependent(oDialog);
                    // Cambiar el título según el tipo de reporte
                    oDialog.setTitle(sDialogTitle);
                    // Guardar el tipo de reporte en el diálogo para uso futuro
                    oDialog.data("reportType", sReportType);
                    oDialog.open();
                }.bind(this));
            } else {
                // Si ya existe, cambiar el título y abrirlo
                this._oReportsDialog.setTitle(sDialogTitle);
                this._oReportsDialog.data("reportType", sReportType);

                var oBtnVisualizar = sap.ui.core.Fragment.byId(oView.getId(), "btnVisualizar");
                if (oBtnVisualizar) {
                    oBtnVisualizar.setVisible(sReportType === "maniobras");
                }

                this._oReportsDialog.open();
            }
        },

        onDownloadExcel: function () {
            var oDialog = this._oReportsDialog;
            if (!oDialog) {
                return;
            }

            // Intentar obtener los DatePickers usando this.byId (ya que el fragment se carga con id de la vista)
            var oFechaInicio = this.byId("fechaInicio");
            var oFechaFin = this.byId("fechaFin");

            // Si no se encuentran, intentar con Fragment.byId
            if (!oFechaInicio) {
                oFechaInicio = sap.ui.core.Fragment.byId(this.getView().getId(), "fechaInicio");
            }
            if (!oFechaFin) {
                oFechaFin = sap.ui.core.Fragment.byId(this.getView().getId(), "fechaFin");
            }

            if (!oFechaInicio || !oFechaFin) {
                MessageToast.show("No se pudieron obtener los DatePickers.");
                return;
            }

            var oDateInicio = oFechaInicio.getDateValue();
            var oDateFin = oFechaFin.getDateValue();

            if (!oDateInicio || !oDateFin) {
                MessageBox.warning("Por favor, seleccione ambas fechas (Inicio y Fin).");
                return;
            }

            if (oDateInicio > oDateFin) {
                MessageBox.warning("La fecha de inicio no puede ser mayor que la fecha de fin.");
                return;
            }

            // Obtener el tipo de reporte del diálogo
            var sReportType = oDialog.data("reportType") || "amplio"; // Por defecto "amplio"

            // Mostrar diálogo de carga
            this.showGlobalBusy("Buscando turnos para el reporte...");

            const oView = this.getView();
            const oDataService = this.getView().getModel();

            // Generar array de fechas del rango (desde fecha inicio hasta fecha fin, día por día)
            // Usar UTC para que OData las serialice como 00:00:00 UTC
            const aFechas = [];
            const oFechaInicioUTC = new Date(Date.UTC(
                oDateInicio.getFullYear(),
                oDateInicio.getMonth(),
                oDateInicio.getDate(),
                0, 0, 0, 0
            ));
            const oFechaFinUTC = new Date(Date.UTC(
                oDateFin.getFullYear(),
                oDateFin.getMonth(),
                oDateFin.getDate(),
                0, 0, 0, 0
            ));

            // Incluir también la fecha fin (agregar un día)
            const oFechaFinLimiteUTC = new Date(oFechaFinUTC);
            oFechaFinLimiteUTC.setUTCDate(oFechaFinLimiteUTC.getUTCDate() + 1);

            const oFechaActualUTC = new Date(oFechaInicioUTC);
            while (oFechaActualUTC < oFechaFinLimiteUTC) {
                // Crear nueva fecha en UTC a las 00:00:00
                const oFechaNormalizada = new Date(Date.UTC(
                    oFechaActualUTC.getUTCFullYear(),
                    oFechaActualUTC.getUTCMonth(),
                    oFechaActualUTC.getUTCDate(),
                    0, 0, 0, 0
                ));
                aFechas.push(oFechaNormalizada);
                oFechaActualUTC.setUTCDate(oFechaActualUTC.getUTCDate() + 1);
            }

            const sEntity = "/TurnosLicenciasSet";

            // Crear array de Promises, una llamada por cada fecha
            const aPromises = aFechas.map((oFecha) => {
                return new Promise((resolve, reject) => {
                    const aFilters = [];
                    // La fecha ya está en UTC a las 00:00:00
                    aFilters.push(new Filter("Dateturno", FilterOperator.EQ, oFecha));
                    aFilters.push(new Filter("Empresa", FilterOperator.EQ, "100"));

                    oDataService.read(sEntity, {
                        filters: aFilters,
                        success: (oData) => {
                            // Retornar los results de esta fecha (puede ser array vacío)
                            resolve(oData.results || []);
                        },
                        error: (oError) => {
                            resolve([]);
                        }
                    });
                });
            });

            // Ejecutar todas las llamadas en paralelo y acumular resultados
            Promise.all(aPromises)
                .then((aResultadosPorFecha) => {
                    // Acumular todos los resultados en un único array
                    const aTodosLosResultados = [];
                    aResultadosPorFecha.forEach((aResultados) => {
                        if (Array.isArray(aResultados) && aResultados.length > 0) {
                            aTodosLosResultados.push(...aResultados);
                        }
                    });

                    // Crear objeto con formato similar al que espera processReportData
                    const oDataAcumulado = {
                        results: aTodosLosResultados
                    };

                    // Procesar todos los datos acumulados, pasando el tipo de reporte
                    return this.processReportData(oDataAcumulado, oDateInicio, oDateFin, sReportType);
                })
                .catch((err) => {
                    MessageToast.show("Error al procesar los datos del reporte.");
                })
                .finally(() => {
                    this.hideGlobalBusy();
                });
        },

        processReportData: function (data, oDateInicio, oDateFin, sReportType) {
            const oView = this.getView();
            const oDataModel = this.getView().getModel();

            // Si no se pasa el tipo de reporte, usar "amplio" por defecto
            sReportType = sReportType || "amplio";

            const aResults = Array.isArray(data?.results) ? data.results : [];

            if (!aResults.length) {
                MessageBox.information("No se encontraron turnos para el rango de fechas seleccionado.");
                return Promise.resolve();
            }

            // Buscar información de cada licencia usando LicenseService.FIND()
            // Mantener la fecha del turno (Dateturno) de cada resultado
            const aPromises = aResults.map((licencia) => {
                var oDateturno = licencia.Dateturno; // Guardar la fecha del turno
                return LicenseService.FIND(licencia, oDataModel)
                    .then(result => {
                        // Agregar la fecha del turno al resultado
                        if (result) {
                            result.Dateturno = oDateturno;
                        }
                        return result;
                    })
                    .catch(err => {
                        return null;
                    });
            });

            return Promise.all(aPromises)
                .then((licenciasProcesadas) => {
                    const results = licenciasProcesadas.filter(x => x);

                    if (!results.length) {
                        MessageBox.information("No se encontró información para las licencias del rango de fechas.");
                        return;
                    }

                    // Aplicar las mismas funciones de procesamiento que se usan en la tabla principal
                    // Esto se aplica a ambos tipos de reporte (amplio y maniobras)
                    const arrayOrdenado = TurnosService.encontrarGrupo(
                        TurnosService.ordenarPorEqunr(results),
                        oView
                    );
                    TurnosService.assignShiftsToLicences(arrayOrdenado);

                    // Decidir qué función llamar según el tipo de reporte
                    if (sReportType === "amplio") {
                        // Generar el Excel con los datos procesados y las fechas del rango
                        this.createExcelReport(arrayOrdenado, oDateInicio, oDateFin);
                    } else if (sReportType === "maniobras") {
                        // Generar el Excel de resumen de maniobras
                        this.createExcelReportManiobras(arrayOrdenado, oDateInicio, oDateFin);
                    }
                })
                .catch((error) => {
                    MessageToast.show("Error al procesar las licencias.");
                });
        },

        createExcelReport: function (aData, oDateInicio, oDateFin) {
            // Cargar la librería XLSX
            jQuery.sap.require("transener.sistemadeturnos.libs.xlsx");

            // Verificar que XLSX esté disponible
            if (typeof XLSX === 'undefined' || !XLSX || !XLSX.utils) {
                MessageBox.error("No se pudo cargar la librería XLSX. Asegúrese de que el archivo esté en webapp/libs/xlsx/xlsx.full.min.js");
                return;
            }

            // Si existe make_xlsx_lib, inicializarlo (como en el código que funciona)
            if (typeof make_xlsx_lib === 'function') {
                make_xlsx_lib(XLSX);
            }

            try {
                // Crear workbook
                var Workbook = XLSX.utils.book_new();

                // SOLAPA 1: Datos de Licencias
                var aDatosLicencias = this.prepareLicenciasData(aData);
                var ws1 = XLSX.utils.aoa_to_sheet([]);
                var sheet1 = XLSX.utils.sheet_add_json(ws1, aDatosLicencias, {
                    origin: "A1"
                });
                XLSX.utils.book_append_sheet(Workbook, sheet1, "Licencias");

                // SOLAPA 2: Resumen por Fecha
                var aDatosResumen = this.prepareResumenPorFecha(aData, oDateInicio, oDateFin);
                var sheet2 = XLSX.utils.aoa_to_sheet(aDatosResumen);
                XLSX.utils.book_append_sheet(Workbook, sheet2, "Resumen por Fecha");

                // Descargar el archivo
                var sFileName = "Reporte Amplio.xlsx";
                XLSX.writeFile(Workbook, sFileName, {
                    cellStyles: true
                });

                MessageToast.show("Reporte Excel generado correctamente.");

                // Cerrar el diálogo y limpiar las fechas
                this.onCancelReports();
                this.clearReportDates();
            } catch (error) {
                MessageBox.error("Error al generar el archivo Excel: " + error.message);
            }
        },

        createExcelReportManiobras: function (aData, oDateInicio, oDateFin) {
            // Cargar la librería XLSX
            jQuery.sap.require("transener.sistemadeturnos.libs.xlsx");

            // Verificar que XLSX esté disponible
            if (typeof XLSX === 'undefined' || !XLSX || !XLSX.utils) {
                MessageBox.error("No se pudo cargar la librería XLSX. Asegúrese de que el archivo esté en webapp/libs/xlsx/xlsx.full.min.js");
                return;
            }

            // Si existe make_xlsx_lib, inicializarlo
            if (typeof make_xlsx_lib === 'function') {
                make_xlsx_lib(XLSX);
            }

            try {
                var oFormatter = this.formatter;
                // Crear workbook
                var Workbook = XLSX.utils.book_new();

                // SOLAPA 1: Resumen por Fecha
                var aDatosResumen = this.prepareResumenPorFecha(aData, oDateInicio, oDateFin);
                var sheet1 = XLSX.utils.aoa_to_sheet(aDatosResumen);

                // Calcular dónde empezar las nuevas grillas
                var iFilaInicioGrillas = aDatosResumen.length + 3;

                // Función helper para convertir número de columna a letra de Excel
                var getColumnLetter = function (colNum) {
                    var result = "";
                    while (colNum >= 0) {
                        result = String.fromCharCode(65 + (colNum % 26)) + result;
                        colNum = Math.floor(colNum / 26) - 1;
                    }
                    return result;
                };

                // Variable para rastrear en qué columna empezar la siguiente grilla
                var iColumnaActual = 0;

                // Generar array de fechas del rango
                var aFechas = [];
                var oFechaActual = new Date(oDateInicio);
                var oFechaFin = new Date(oDateFin);
                oFechaFin.setDate(oFechaFin.getDate() + 1);

                while (oFechaActual < oFechaFin) {
                    aFechas.push(new Date(oFechaActual));
                    oFechaActual.setDate(oFechaActual.getDate() + 1);
                }

                var todosLosDatosExcel = [];

                // Para cada fecha, crear una grilla
                aFechas.forEach(function (oFecha) {
                    var sFechaFormateada = oFormatter.formatDate(oFecha);

                    // Filtrar licencias de esta fecha
                    var aLicenciasFecha = aData.filter(function (license) {
                        if (!license.Dateturno) {
                            return false;
                        }

                        // Normalizar fecha del turno a UTC 00:00:00
                        var oFechaTurno = new Date(license.Dateturno);
                        var iAnioUTC = oFechaTurno.getUTCFullYear();
                        var iMesUTC = oFechaTurno.getUTCMonth();
                        var iDiaUTC = oFechaTurno.getUTCDate();
                        var oFechaTurnoNormalizada = new Date(Date.UTC(iAnioUTC, iMesUTC, iDiaUTC, 0, 0, 0, 0));

                        // Normalizar fecha actual a UTC 00:00:00
                        var oFechaNormalizada = new Date(Date.UTC(
                            oFecha.getFullYear(),
                            oFecha.getMonth(),
                            oFecha.getDate(),
                            0, 0, 0, 0
                        ));

                        // Comparar las fechas normalizadas en UTC
                        return oFechaNormalizada.getTime() === oFechaTurnoNormalizada.getTime();
                    });


                    // Eliminar duplicados basados en Equnr + TurnoAsignado
                    var aLicenciasUnicas = [];
                    var oMapaDuplicados = {};

                    aLicenciasFecha.forEach(function (license) {
                        var sEquipo = license.Equnr || "";
                        var sTurno = license.TurnoAsignado || "";
                        var sClave = sEquipo + "|" + sTurno;

                        if (!oMapaDuplicados[sClave]) {
                            oMapaDuplicados[sClave] = true;
                            aLicenciasUnicas.push(license);
                        }
                    });

                    // Crear la grilla para esta fecha
                    var aGrillaFecha = [];
                    aGrillaFecha.push(["Horarios de maniobras previstos " + sFechaFormateada]);
                    aGrillaFecha.push(["Equipo", "Hora", "Comentarios"]);

                    // Datos
                    aLicenciasUnicas.forEach(function (license) {
                        var sEquipo = license.Equnr || "";
                        var sHora = license.TurnoAsignado || (license.Horainicio ? oFormatter.durationToTime(license.Horainicio)
                            : (license.Gdate ? oFormatter.msTohoursSeconds(license.Gdate) : ""));
                        var sComentarios = license.Comments || license.PatAdic || "";

                        aGrillaFecha.push([sEquipo, sHora, sComentarios]);

                        // Acumular para comparación
                        todosLosDatosExcel.push({
                            Fecha: sFechaFormateada,
                            Equipo: sEquipo,
                            Hora: sHora,
                            Comentarios: sComentarios
                        });
                    });

                    // Agregar la grilla al sheet
                    var sColumnaInicio = getColumnLetter(iColumnaActual);
                    var iFilaInicio = iFilaInicioGrillas + 1;
                    XLSX.utils.sheet_add_aoa(sheet1, aGrillaFecha, {
                        origin: sColumnaInicio + iFilaInicio.toString()
                    });

                    // Avanzar columnas
                    iColumnaActual += 3 + 2;
                }.bind(this));

                XLSX.utils.book_append_sheet(Workbook, sheet1, "Resumen por Fecha");

                // Descargar el archivo
                var sFileName = "Resumen Maniobras.xlsx";
                XLSX.writeFile(Workbook, sFileName, {
                    cellStyles: true
                });

                MessageToast.show("Reporte Excel de maniobras generado correctamente.");

                // Cerrar el diálogo y limpiar las fechas
                this.onCancelReports();
                this.clearReportDates();
            } catch (error) {
                MessageBox.error("Error al generar el archivo Excel: " + error.message);
            }
        },


        clearReportDates: function () {
            // Obtener los DatePickers del fragment
            var oFechaInicio = this.byId("fechaInicio");
            var oFechaFin = this.byId("fechaFin");

            // Si no se encuentran, intentar con Fragment.byId
            if (!oFechaInicio) {
                oFechaInicio = sap.ui.core.Fragment.byId(this.getView().getId(), "fechaInicio");
            }
            if (!oFechaFin) {
                oFechaFin = sap.ui.core.Fragment.byId(this.getView().getId(), "fechaFin");
            }

            // Limpiar las fechas
            if (oFechaInicio) {
                oFechaInicio.setValue("");
            }
            if (oFechaFin) {
                oFechaFin.setValue("");
            }
        },

        prepareLicenciasData: function (aData) {
            var that = this;
            var oFormatter = this.formatter;

            return aData.map(function (license) {
                return {
                    "Equipo": license.Equnr || "",
                    "IdLicencia": license.Id || "",
                    "Estado": oFormatter.getEstado(license.Equstat) || "",
                    "CondTrabajo": oFormatter.getJobCond(license.Jobcond) || "",
                    "HoraInicio": license.Horainicio ? oFormatter.durationToTime(license.Horainicio) : (license.Gdate ? oFormatter.msTohoursSeconds(license.Gdate) : ""),
                    "TrabajoRealizar": license.Comments || "",
                    "Region": oFormatter.getRegiones(license.Werks) || "",
                    "Consola": license.Consola || "",
                    "Turno": license.TurnoAsignado || "",
                    "Comentario": license.Comentarios || "",
                    "Licstat": license.Licstat || ""
                };
            });
        },

        prepareResumenPorFecha: function (aData, oDateInicio, oDateFin) {
            var that = this;
            var oFormatter = this.formatter;
            var aResultado = [];

            // Encabezados
            aResultado.push([
                "Fecha",
                "Cantidad de LLTT",
                "LLTT con maniobras",
                "Cantidad de TcT",
                "Cantidad de LLTT sin maniobras"
            ]);

            // Generar array de fechas del rango
            var aFechas = [];
            var oFechaActual = new Date(oDateInicio);
            var oFechaFin = new Date(oDateFin);

            // Agregar un día a la fecha fin para incluirla en el rango
            oFechaFin.setDate(oFechaFin.getDate() + 1);

            while (oFechaActual < oFechaFin) {
                aFechas.push(new Date(oFechaActual));
                oFechaActual.setDate(oFechaActual.getDate() + 1);
            }

            // Para cada fecha, agrupar las licencias y calcular contadores
            aFechas.forEach(function (oFecha) {
                // Filtrar licencias de esta fecha
                var aLicenciasFecha = aData.filter(function (license) {
                    if (!license.Dateturno) return false;

                    // Convertir Dateturno a Date
                    var oFechaTurno = new Date(license.Dateturno);

                    // Usar los métodos UTC para obtener la fecha real que representa
                    // El backend envía en UTC pero se muestra en zona local
                    // Ejemplo: Mon Nov 03 2025 21:00:00 GMT-0300 representa Tue Nov 04 2025 00:00:00 UTC
                    var iAnioUTC = oFechaTurno.getUTCFullYear();
                    var iMesUTC = oFechaTurno.getUTCMonth();
                    var iDiaUTC = oFechaTurno.getUTCDate();

                    // Crear fecha normalizada usando UTC (fecha real del backend)
                    var oFechaTurnoNormalizada = new Date(Date.UTC(iAnioUTC, iMesUTC, iDiaUTC, 0, 0, 0, 0));

                    // Normalizar la fecha del rango también a UTC para comparar
                    var oFechaNormalizada = new Date(Date.UTC(
                        oFecha.getFullYear(),
                        oFecha.getMonth(),
                        oFecha.getDate(),
                        0, 0, 0, 0
                    ));

                    // Comparar las fechas normalizadas en UTC
                    return oFechaNormalizada.getTime() === oFechaTurnoNormalizada.getTime();
                });

                // Calcular contadores usando la misma lógica que Utils.onCountItems
                // Crear una vista temporal para evitar errores
                var oTempView = { setModel: function () { } }; // Vista dummy
                var oCounts = Utils.onCountItems(oTempView, aLicenciasFecha);

                // Formatear fecha
                var sFechaFormateada = oFormatter.formatDate(oFecha);

                // Agregar fila al resultado
                aResultado.push([
                    sFechaFormateada,
                    oCounts.Total,
                    oCounts.LTWithManouvers,
                    oCounts.TCT,
                    oCounts.LTWithoutManouvers
                ]);
            });

            return aResultado;
        },


        onCancelReports: function () {
            if (this._oReportsDialog) {
                this._oReportsDialog.close();
            }
        },

        // ==================== MÉTODOS DE FILTRADO Y BÚSQUEDA ====================

        onFilter: function () {
            const oView = this.getView();
            const oTable = this.byId("turnosTable");
            const oBinding = oTable.getBinding("rows");

            if (!oBinding) {
                sap.m.MessageToast.show("No hay datos para filtrar");
                return;
            }

            const aFilters = [];

            const oFiltersModel = this.getView().getModel("FiltersJsonModel");
            const oFiltersData = oFiltersModel.getData();

            // 1. Región
            const sRegion = oFiltersData.Werks?.value;
            if (sRegion) {
                aFilters.push(new sap.ui.model.Filter("Werks", sap.ui.model.FilterOperator.EQ, sRegion));
            }

            // 2. E.T. (Estaciones) - MultiComboBox
            const oEstacionesCombo = this.byId("Estaciones");
            const aEstacionesKeys = oEstacionesCombo.getSelectedKeys();
            if (aEstacionesKeys && aEstacionesKeys.length > 0) {
                const aEstacionesFilters = aEstacionesKeys.map(sKey =>
                    new sap.ui.model.Filter("Tplnr", sap.ui.model.FilterOperator.EQ, sKey)
                );
                aFilters.push(new sap.ui.model.Filter({
                    filters: aEstacionesFilters,
                    and: false // OR
                }));
            }

            // 3. Equipo Solicitado CAMMESA
            const sEquipCammesa = oFiltersData.Equnr?.value;
            if (sEquipCammesa) {
                aFilters.push(new sap.ui.model.Filter("Equnr", sap.ui.model.FilterOperator.EQ, sEquipCammesa));
            }

            // 4. Estado Equipo CAMMESA - CON SOPORTE PARA VALORES VACÍOS
            const oEqustatFilter = oFiltersData.Equstat;
            if (oEqustatFilter && oEqustatFilter.value !== "N") {
                if (this.acceptEmptyValues("Equstat", oEqustatFilter)) {
                    if (oEqustatFilter.value === "") {
                        aFilters.push(
                            new sap.ui.model.Filter({
                                filters: [
                                    new sap.ui.model.Filter("Equstat", sap.ui.model.FilterOperator.EQ, ""),
                                    new sap.ui.model.Filter("Equstat", sap.ui.model.FilterOperator.EQ, null)
                                ],
                                and: false
                            })
                        );
                    } else {
                        // Filtro normal para "X"
                        aFilters.push(new sap.ui.model.Filter("Equstat", sap.ui.model.FilterOperator.EQ, oEqustatFilter.value));
                    }
                }
            }

            // 5. Bloqueo de Recierre
            const oBloqueoFilter = oFiltersData.Bloqueo;
            if (oBloqueoFilter && oBloqueoFilter.value !== "") {
                if (oBloqueoFilter.value === "X" || oBloqueoFilter.value === "N") {
                    aFilters.push(new sap.ui.model.Filter("Bloqueo", sap.ui.model.FilterOperator.EQ, oBloqueoFilter.value));
                }
            }

            // 6. Riesgo de disparo
            const oRdisparoFilter = oFiltersData.Rdisparo;
            if (oRdisparoFilter && oRdisparoFilter.value !== "") {
                if (oRdisparoFilter.value === "X") {
                    // SI = buscar X en el backend
                    aFilters.push(new sap.ui.model.Filter("Rdisparo", sap.ui.model.FilterOperator.EQ, "X"));
                } else if (oRdisparoFilter.value === "N") {
                    // NO = buscar valores vacíos en el backend
                    aFilters.push(
                        new sap.ui.model.Filter({
                            filters: [
                                new sap.ui.model.Filter("Rdisparo", sap.ui.model.FilterOperator.EQ, ""),
                                new sap.ui.model.Filter("Rdisparo", sap.ui.model.FilterOperator.EQ, null)
                            ],
                            and: false
                        })
                    );
                }
            }

            // 7. Búsqueda rápida (si existe)
            const oFastSearchInput = this.byId("fastSearchInput");
            if (oFastSearchInput) {
                const sFastSearch = oFastSearchInput.getValue();
                if (sFastSearch) {
                    const aFastSearchFilters = [
                        new sap.ui.model.Filter("Id", sap.ui.model.FilterOperator.Contains, sFastSearch),
                        new sap.ui.model.Filter("Equnr", sap.ui.model.FilterOperator.Contains, sFastSearch),
                    ];
                    aFilters.push(new sap.ui.model.Filter({
                        filters: aFastSearchFilters,
                        and: false // OR
                    }));
                }
            }

            console.groupEnd();

            // Aplicar filtros
            if (aFilters.length > 0) {
                oBinding.filter(aFilters);
                sap.m.MessageToast.show(`Filtros aplicados`);
            } else {
                oBinding.filter([]);
                sap.m.MessageToast.show("No hay filtros seleccionados");
            }

            const oTreeTable = this.byId("cronoTreeTable");
            if (oTreeTable) {
                if (aFilters.length > 0) {
                    const oTreeModel = this.getView().getModel("listCronoTreeModel");
                    const aOriginalData = oTreeModel.getData();
                    const aFilteredData = TreeTableHelper.applyFiltersToTree(aOriginalData, aFilters);
                    const oFilteredModel = new JSONModel(aFilteredData);
                    oTreeTable.setModel(oFilteredModel, "listCronoTreeModel");
                } else {
                    const oTreeModel = this.getView().getModel("listCronoTreeModel");
                    oTreeTable.setModel(oTreeModel, "listCronoTreeModel");
                }
            }
        },

        changeUbicacion: function (oEvent) {
            const oMultiComboBox = oEvent.getSource();
            const aSelectedKeys = oMultiComboBox.getSelectedKeys();
            const oEquipCammesaCombo = this.byId("EquipCammesa");

            // Si no hay estaciones seleccionadas, deshabilitar y limpiar EquipCammesa
            if (!aSelectedKeys || aSelectedKeys.length === 0) {
                oEquipCammesaCombo.setEnabled(false);
                oEquipCammesaCombo.setSelectedKey("");

                // Limpiar el modelo de equipos
                const oEquiposModel = this.getView().getModel("EquiposJsonModel");
                if (oEquiposModel) {
                    oEquiposModel.setData({ Equipos: [] });
                }

                return;
            }

            // Mostrar indicador de carga
            this.getView().setBusy(true);

            // Preparar los filtros para el OData
            const aFilters = [];

            // Filtro por Estaciones (OR entre las seleccionadas)
            const aEstacionFilters = aSelectedKeys.map(sEstacion =>
                new sap.ui.model.Filter("Estacion", sap.ui.model.FilterOperator.EQ, sEstacion)
            );
            if (aEstacionFilters.length > 0) {
                aFilters.push(new sap.ui.model.Filter({
                    filters: aEstacionFilters,
                    and: false // OR
                }));
            }

            // Filtros fijos
            aFilters.push(new sap.ui.model.Filter("Rol", sap.ui.model.FilterOperator.EQ, "hab_Aprobacion_habilitaciones"));
            aFilters.push(new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, "100"));

            // Obtener el modelo OData
            const oModel = this.getView().getModel(); // Tu modelo OData principal

            // Realizar la llamada
            oModel.read("/EquiposRolesSet", {
                filters: aFilters,
                success: (oData) => {

                    // Guardar los datos en el modelo JSON
                    const oEquiposModel = this.getView().getModel("EquiposJsonModel");
                    if (!oEquiposModel) {
                        const oNewModel = new sap.ui.model.json.JSONModel();
                        oNewModel.setData({ Equipos: oData.results });
                        this.getView().setModel(oNewModel, "EquiposJsonModel");
                    } else {
                        oEquiposModel.setData({ Equipos: oData.results });
                    }

                    // Habilitar el ComboBox de Equipos
                    oEquipCammesaCombo.setEnabled(true);

                    // Limpiar selección previa
                    oEquipCammesaCombo.setSelectedKey("");

                    // Limpiar el valor en el modelo de filtros
                    const oFiltersModel = this.getView().getModel("FiltersJsonModel");
                    if (oFiltersModel) {
                        oFiltersModel.setProperty("/Equnr/value", "");
                    }

                    this.getView().setBusy(false);

                    if (oData.results.length === 0) {
                        sap.m.MessageToast.show("No se encontraron equipos para las estaciones seleccionadas");
                    }
                },
                error: (oError) => {
                    this.getView().setBusy(false);
                    sap.m.MessageBox.error("Error al cargar los equipos. Por favor intente nuevamente.");

                    // Deshabilitar el combo en caso de error
                    oEquipCammesaCombo.setEnabled(false);
                }
            });
        },
        // Limpia todos los filtros aplicados a la tabla

        onClearFilter: function () {

            this._limpiarAccionesEntrega();

            // 1. Limpiar Región
            const oRegionCombo = this.byId("Region");
            if (oRegionCombo) {
                oRegionCombo.setSelectedKey("");
            }

            // 2. Limpiar Estaciones (MultiComboBox)
            const oEstacionesCombo = this.byId("Estaciones");
            if (oEstacionesCombo) {
                oEstacionesCombo.setSelectedKeys([]);
            }

            // 3. Limpiar Equipo CAMMESA
            const oEquipCammesaCombo = this.byId("EquipCammesa");
            if (oEquipCammesaCombo) {
                oEquipCammesaCombo.setSelectedKey("");
                oEquipCammesaCombo.setEnabled(false);
            }

            // 4. Limpiar Estado Equipo CAMMESA
            const oStatusECammesaCombo = this.byId("StatusECammesa");
            if (oStatusECammesaCombo) {
                oStatusECammesaCombo.setSelectedKey("N");
            }

            // Limpiar Bloqueo de Recierre
            const oERecierreCombo = this.byId("ERecierre");
            if (oERecierreCombo) {
                oERecierreCombo.setSelectedKey("");
            }

            // Limpiar Riesgo de Disparo
            const oEDisparoCombo = this.byId("EDisparo");
            if (oEDisparoCombo) {
                oEDisparoCombo.setSelectedKey("");
            }

            // 7. Limpiar búsqueda rápida
            const oFastSearchInput = this.byId("fastSearchInput");
            if (oFastSearchInput) {
                oFastSearchInput.setValue("");
            }

            // 8. Limpiar filtros de la tabla
            const oTable = this.byId("turnosTable");
            const oBinding = oTable.getBinding("rows");
            if (oBinding) {
                oBinding.filter([]);
            }

            sap.m.MessageToast.show("Filtros limpiados");

            const oTreeTable = this.byId("cronoTreeTable");
            if (oTreeTable) {
                const oTreeModel = this.getView().getModel("listCronoTreeModel");
                if (oTreeModel) {
                    oTreeTable.setModel(oTreeModel, "listCronoTreeModel");
                }
            }
        },

        acceptEmptyValues: function (sAttribute, oFilterObject) {
            switch (sAttribute) {
                case "Equstatnocam":
                case "Equstat":
                case "Bloqueo":
                case "Rdisparo":
                    return true;
                default:
                    return oFilterObject.value !== "";
            }
        },

        // Handler para cuando se expande/colapsa un nodo en TreeTable

        onToggleOpenState: function (oEvent) {
            const iRowIndex = oEvent.getParameter("rowIndex");
            const oRowContext = oEvent.getParameter("rowContext");
            const bExpanded = oEvent.getParameter("expanded");

            console.log(
                bExpanded ? "📂 Expandido:" : "📁 Colapsado:",
                oRowContext.getProperty("Equnr"),
                "-",
                oRowContext.getProperty("InitHourSort")
            );
        },

        // Expandir todos los grupos en TreeTable

        onExpandAllGroups: function () {
            const oTreeTable = this.byId("cronoTreeTable");
            if (oTreeTable) {
                oTreeTable.expandToLevel(1);
                MessageToast.show("Todos los grupos expandidos");
            }
        },

        // Colapsar todos los grupos en TreeTable

        onCollapseAllGroups: function () {
            const oTreeTable = this.byId("cronoTreeTable");
            if (oTreeTable) {
                oTreeTable.collapseAll();
                MessageToast.show("Todos los grupos colapsados");
            }
        },

        // Refresca los datos de la tabla cargando nuevamente el turno actual

        onRefresh: function () {
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            const oDatePicker = this.byId("date");
            const oDateValue = oDatePicker.getDateValue();

            if (!oDateValue) {
                sap.m.MessageToast.show("Seleccione una fecha primero");
                return;
            }

            // Recargar datos
            this.showGlobalBusy(oResourceBundle.getText("updatingData") || "Actualizando datos...");

            const oView = this.getView();
            const oDataService = this.getView().getModel();

            const aFilters = [
                new sap.ui.model.Filter("Dateturno", sap.ui.model.FilterOperator.EQ, oDateValue),
                new sap.ui.model.Filter("Empresa", sap.ui.model.FilterOperator.EQ, "100")
            ];

            oDataService.read("/TurnosLicenciasSet", {
                filters: aFilters,
                success: (oData) => {

                    this.successSelectTurno(oData)
                        .then(() => {
                            this.hideGlobalBusy();
                            sap.m.MessageToast.show("Datos actualizados correctamente");
                        })
                        .catch((error) => {
                            this.hideGlobalBusy();
                            sap.m.MessageBox.error("Error al procesar los datos");
                        });
                },
                error: (oError) => {
                    console.groupEnd();

                    this.hideGlobalBusy();
                    sap.m.MessageBox.error("Error al actualizar los datos");
                }
            });
        },

        //-------------------------------- Editar turnos -------------------------

        _isEditableTurno: function (fechaTurno) {
            if (!fechaTurno) {
                return false;
            }
            const oFechaTurno = new Date(fechaTurno);
            const oFechaTurnoNormalizada = new Date(Date.UTC(
                oFechaTurno.getUTCFullYear(),
                oFechaTurno.getUTCMonth(),
                oFechaTurno.getUTCDate(),
                0, 0, 0, 0
            ));

            const oHoy = new Date();
            const oHoyNormalizada = new Date(Date.UTC(
                oHoy.getFullYear(),
                oHoy.getMonth(),
                oHoy.getDate(),
                0, 0, 0, 0
            ));

            return oFechaTurnoNormalizada.getTime() >= oHoyNormalizada.getTime();
        },


        _isTimeInRestrictedRange: function (sTime) {
            if (!sTime || typeof sTime !== "string") {
                return false;
            }

            const aTimeParts = sTime.split(":");
            if (aTimeParts.length !== 2) {
                return false;
            }

            const iHours = parseInt(aTimeParts[0], 10);
            const iMinutes = parseInt(aTimeParts[1], 10);

            if (isNaN(iHours) || isNaN(iMinutes)) {
                return false;
            }

            const iTotalMinutes = iHours * 60 + iMinutes;
            const iStartRestricted = 5 * 60 + 30;
            const iEndRestricted = 6 * 60 + 30;

            return iTotalMinutes >= iStartRestricted && iTotalMinutes <= iEndRestricted;
        },

        // ==================== MÉTODOS DE ALERTAS DE LICENCIAS SIN ASIGNAR ====================


        _checkUnassignedLicenses: function (oFechaTurno) {
            if (!oFechaTurno) {
                return;
            }

            if (this._suppressLicenseAlert === true) {
                this._suppressLicenseAlert = false;
                return;
            }

            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());
            const aLicenciasAsignadas = oLicencesModel?.getData() || [];

            TurnosService.search({ FechaTurno: oFechaTurno, oView: this.getView(), isRefresh: true })
                .then((aTodasLasLicencias) => {
                    const idsAsignados = new Set(aLicenciasAsignadas.map(l => l.Id));
                    const aLicenciasSinAsignar = aTodasLasLicencias.filter(lic => !idsAsignados.has(lic.Id));

                    if (aLicenciasSinAsignar.length > 0) {
                        const sMessage = oResourceBundle.getText("licensesWithoutShiftMessage", [aLicenciasSinAsignar.length]);
                        const sDetail = oResourceBundle.getText("licensesWithoutShiftDetail");

                        MessageBox.information(sMessage + "\n\n" + sDetail, {
                            title: oResourceBundle.getText("licensesWithoutShift"),
                            styleClass: "sapUiSizeCompact"
                        });
                    }
                })
                .catch((error) => {
                    console.error("Error al verificar licencias sin asignar:", error);
                });
        },


        _checkNewLicensesBeforeSave: function (oFechaTurno) {
            return new Promise((resolve, reject) => {
                if (!oFechaTurno) {
                    resolve(true);
                    return;
                }

                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());
                const aLicenciasAsignadas = oLicencesModel?.getData() || [];

                TurnosService.search({ FechaTurno: oFechaTurno, oView: this.getView(), isRefresh: true })
                    .then((aTodasLasLicencias) => {
                        const idsAsignados = new Set(aLicenciasAsignadas.map(l => l.Id));

                        const aLicenciasSinAsignar = aTodasLasLicencias.filter(lic => !idsAsignados.has(lic.Id));

                        if (aLicenciasSinAsignar.length > 0) {
                            const sMessage = oResourceBundle.getText("newLicensesWithoutShiftMessage", [aLicenciasSinAsignar.length]);
                            const sDetail = oResourceBundle.getText("confirmSaveWithPendingLicenses");

                            MessageBox.warning(sMessage + "\n\n" + sDetail, {
                                title: oResourceBundle.getText("newLicensesAvailable"),
                                actions: [MessageBox.Action.YES, MessageBox.Action.NO],
                                emphasizedAction: MessageBox.Action.NO,
                                onClose: function (sAction) {
                                    if (sAction === MessageBox.Action.YES) {
                                        resolve(true);
                                    } else {
                                        resolve(false);
                                    }
                                }
                            });
                        } else {
                            resolve(true);
                        }
                    })
                    .catch((error) => {
                        console.error("Error al verificar licencias antes de guardar:", error);
                        resolve(true);
                    });
            });
        },

        // ---------------------- REORDENAMIENTO GRUPOS ----------------
        /**
         * Recalcula el campo Grupo SOLO para el frontend:
         * - Si Equnr + TurnoAsignado es igual => mismo Grupo
         * - Si no coincide con nadie => grupo solo
         * - Si es desacoplado => mantiene "desacoplado_idLicencia(<Id>)"
         */
        _rebuildFrontendGroupsByEquipoHora: function (aLicences) {
            if (!Array.isArray(aLicences)) return;

            const mCount = Object.create(null);

            const buildKey = (lic) => {
                const equipo = (lic.Equnr || "").trim();
                const hora = (lic.TurnoAsignado || "").trim();
                return equipo + "|" + hora;
            };

            aLicences.forEach((lic) => {
                const sGrupo = String(lic.Grupo || "");
                const bIsDetached = sGrupo.startsWith("desacoplado_idLicencia(");
                if (bIsDetached) return;

                const key = buildKey(lic);
                mCount[key] = (mCount[key] || 0) + 1;
            });

            aLicences.forEach((lic) => {
                const sGrupo = String(lic.Grupo || "");
                const bIsDetached = sGrupo.startsWith("desacoplado_idLicencia(");
                if (bIsDetached) return;

                const key = buildKey(lic);
                if (mCount[key] > 1) {
                    const equipo = (lic.Equnr || "").trim();
                    const hora = (lic.TurnoAsignado || "").trim().replaceAll(":", "");
                    lic.Grupo = `grp_${equipo}_${hora}`;
                } else {
                    lic.Grupo = `solo_${lic.Id}`;
                }
            });
        },

        _assignGroupColors: function (aLicences) {
            if (!Array.isArray(aLicences)) return;

            const aColors = [
                "#2196F3",
                "#4CAF50",
                "#F44336",
                "#FF9800",
                "#9C27B0",
                "#009688"
            ];

            const mGroupColor = {};
            let iColorIndex = 0;

            aLicences.forEach((lic) => {
                const sGrupo = lic.Grupo;

                if (!sGrupo) {
                    lic.ColorGrupo = "";
                    return;
                }

                if (!mGroupColor[sGrupo]) {
                    mGroupColor[sGrupo] = aColors[iColorIndex % aColors.length];
                    iColorIndex++;
                }

                lic.ColorGrupo = mGroupColor[sGrupo];
            });
        },

        /* ----------------------------- TRAMITACIONES --------------------- */
        getTramitacionHighlight: function (sColor) {
            if (sColor === 'red') return 'Error';
            if (sColor === 'yellow') return 'Warning';
            return 'None';
        },

        // Obtener tooltip informativo
        getTramitacionTooltip: function (oLicencia) {
            if (!oLicencia || !oLicencia.tramitacionProblematica) return "";

            const mEstados = {
                "AS": "Anulada por el solicitante",
                "NA": "No Autorizada",
                "CC": "Condicionada"
            };

            const sEstado = mEstados[oLicencia.tramitacionEstado] || oLicencia.tramitacionEstado;

            if (oLicencia.tramitacionDetalles && oLicencia.tramitacionDetalles.length > 0) {
                const oDetalle = oLicencia.tramitacionDetalles[0];
                return `Estado: ${sEstado}${oDetalle.observaciones ? '\nObservaciones: ' + oDetalle.observaciones : ''}`;
            }

            return `Estado: ${sEstado}`;
        },

        getCalendarioColor: function (sColor) {
            if (sColor === 'red') {
                return '#BB0000';
            }
            if (sColor === 'yellow') {
                return '#E78C07';
            }
            return '#0854A0';
        },

        // ------------------------------ AGREGAR LICENCIA --------------------------------------
        onAgregarLicencia: function (oEvent) {
            MessageToast.show("Funcionalidad en desarrollo");
        },

        // ------------------------------- TAB REPORTES ------------------------------------------

        onVisualizarReporte: function () {
            var oDialog = this._oReportsDialog;
            if (!oDialog) {
                return;
            }

            // Obtener DatePickers
            var oFechaInicio = this.byId("fechaInicio") || sap.ui.core.Fragment.byId(this.getView().getId(), "fechaInicio");
            var oFechaFin = this.byId("fechaFin") || sap.ui.core.Fragment.byId(this.getView().getId(), "fechaFin");

            if (!oFechaInicio || !oFechaFin) {
                MessageToast.show("No se pudieron obtener los DatePickers.");
                return;
            }

            var oDateInicio = oFechaInicio.getDateValue();
            var oDateFin = oFechaFin.getDateValue();

            if (!oDateInicio || !oDateFin) {
                MessageBox.warning("Por favor, seleccione ambas fechas (Inicio y Fin).");
                return;
            }

            if (oDateInicio > oDateFin) {
                MessageBox.warning("La fecha de inicio no puede ser mayor que la fecha de fin.");
                return;
            }

            // Guardar fechas para uso posterior
            this._reporteFechaInicio = oDateInicio;
            this._reporteFechaFin = oDateFin;

            // Obtener tipo de reporte
            var sReportType = oDialog.data("reportType") || "maniobras";

            // Cerrar el diálogo
            oDialog.close();

            // Mostrar busy
            this.showGlobalBusy("Cargando datos del reporte...");

            const oView = this.getView();
            const oDataService = this.getView().getModel();

            // Generar array de fechas
            const aFechas = [];
            const oFechaInicioUTC = new Date(Date.UTC(
                oDateInicio.getFullYear(),
                oDateInicio.getMonth(),
                oDateInicio.getDate(),
                0, 0, 0, 0
            ));
            const oFechaFinUTC = new Date(Date.UTC(
                oDateFin.getFullYear(),
                oDateFin.getMonth(),
                oDateFin.getDate(),
                0, 0, 0, 0
            ));

            const oFechaFinLimiteUTC = new Date(oFechaFinUTC);
            oFechaFinLimiteUTC.setUTCDate(oFechaFinLimiteUTC.getUTCDate() + 1);

            const oFechaActualUTC = new Date(oFechaInicioUTC);
            while (oFechaActualUTC < oFechaFinLimiteUTC) {
                const oFechaNormalizada = new Date(Date.UTC(
                    oFechaActualUTC.getUTCFullYear(),
                    oFechaActualUTC.getUTCMonth(),
                    oFechaActualUTC.getUTCDate(),
                    0, 0, 0, 0
                ));
                aFechas.push(oFechaNormalizada);
                oFechaActualUTC.setUTCDate(oFechaActualUTC.getUTCDate() + 1);
            }

            const sEntity = "/TurnosLicenciasSet";

            // Crear promesas para cada fecha
            const aPromises = aFechas.map((oFecha) => {
                return new Promise((resolve, reject) => {
                    const aFilters = [
                        new Filter("Dateturno", FilterOperator.EQ, oFecha),
                        new Filter("Empresa", FilterOperator.EQ, "100")
                    ];

                    oDataService.read(sEntity, {
                        filters: aFilters,
                        success: (oData) => {
                            resolve(oData.results || []);
                        },
                        error: (oError) => {
                            resolve([]);
                        }
                    });
                });
            });

            // Ejecutar todas las promesas
            Promise.all(aPromises)
                .then((aResultadosPorFecha) => {
                    // Acumular resultados
                    const aTodosLosResultados = [];
                    aResultadosPorFecha.forEach((aResultados) => {
                        if (Array.isArray(aResultados) && aResultados.length > 0) {
                            aTodosLosResultados.push(...aResultados);
                        }
                    });

                    if (!aTodosLosResultados.length) {
                        this.hideGlobalBusy();
                        MessageBox.information("No se encontraron turnos para el rango de fechas seleccionado.");
                        return;
                    }

                    // PROCESAR IGUAL QUE processReportData
                    const oDataModel = this.getView().getModel();
                    const aPromisesLicense = aTodosLosResultados.map((licencia) => {
                        var oDateturno = licencia.Dateturno;
                        return LicenseService.FIND(licencia, oDataModel)
                            .then(result => {
                                if (result) {
                                    result.Dateturno = oDateturno;
                                }
                                return result;
                            })
                            .catch(err => {
                                console.error("Error en FIND para licencia", licencia, err);
                                return null;
                            });
                    });

                    return Promise.all(aPromisesLicense);
                })
                .then((licenciasProcesadas) => {
                    const results = licenciasProcesadas.filter(x => x);

                    if (!results.length) {
                        this.hideGlobalBusy();
                        MessageBox.information("No se encontró información para las licencias del rango de fechas.");
                        return;
                    }

                    // APLICAR MISMO PROCESAMIENTO QUE EL EXCEL
                    const arrayOrdenado = TurnosService.encontrarGrupo(
                        TurnosService.ordenarPorEqunr(results),
                        this.getView()
                    );
                    TurnosService.assignShiftsToLicences(arrayOrdenado);

                    this._datosReporteProcesados = arrayOrdenado;

                    var aDatosTabla = this._procesarDatosComoExcel(arrayOrdenado, oDateInicio, oDateFin);

                    // CARGAR DATOS PROCESADOS EN EL MODELO
                    var oReporteModel = this.getView().getModel("ReporteModel");
                    oReporteModel.setData(aDatosTabla);

                    // Actualizar título y rango de fechas
                    var oTitleControl = this.byId("reporteTitle");
                    var oDateRangeControl = this.byId("reporteDateRange");

                    if (oTitleControl) {
                        oTitleControl.setText(sReportType === "maniobras" ? "Resumen Maniobras" : "Reporte Amplio");
                    }

                    if (oDateRangeControl) {
                        var sFormatter = sap.ui.core.format.DateFormat.getDateInstance({ pattern: "dd/MM/yyyy" });
                        var sFechaInicioStr = sFormatter.format(oDateInicio);
                        var sFechaFinStr = sFormatter.format(oDateFin);
                        oDateRangeControl.setText(`Horarios de maniobras previstas desde: ${sFechaInicioStr} Hasta: ${sFechaFinStr}`);
                    }

                    // Mostrar la tab del reporte
                    var oIconTabBar = this.byId("mainTabBar");
                    if (oIconTabBar) {
                        var oReporteTab = oIconTabBar.getItems().find(item => item.getKey() === "REPORTE");
                        if (oReporteTab) {
                            oReporteTab.setVisible(true);
                        }
                        oIconTabBar.setSelectedKey("REPORTE");
                    }

                    this.hideGlobalBusy();
                    MessageToast.show(`Reporte cargado`);
                })
                .catch((error) => {
                    this.hideGlobalBusy();
                    MessageBox.error("Error al cargar el reporte: " + error.message);
                });
        },

        _procesarDatosComoExcel: function (aData, oDateInicio, oDateFin) {

            var oFormatter = this.formatter;
            var aDatosAplanados = [];

            // Generar array de fechas del rango (IGUAL QUE EL EXCEL)
            var aFechas = [];
            var oFechaActual = new Date(oDateInicio);
            var oFechaFin = new Date(oDateFin);
            oFechaFin.setDate(oFechaFin.getDate() + 1);

            while (oFechaActual < oFechaFin) {
                aFechas.push(new Date(oFechaActual));
                oFechaActual.setDate(oFechaActual.getDate() + 1);
            }

            // Para cada fecha, procesar IGUAL QUE EL EXCEL
            aFechas.forEach(function (oFecha) {
                var sFechaFormateada = oFormatter.formatDate(oFecha);

                // Filtrar licencias de esta fecha (IGUAL QUE EL EXCEL)
                var aLicenciasFecha = aData.filter(function (license) {
                    if (!license.Dateturno) {
                        return false;
                    }

                    // Normalizar fecha del turno a UTC 00:00:00
                    var oFechaTurno = new Date(license.Dateturno);
                    var iAnioUTC = oFechaTurno.getUTCFullYear();
                    var iMesUTC = oFechaTurno.getUTCMonth();
                    var iDiaUTC = oFechaTurno.getUTCDate();
                    var oFechaTurnoNormalizada = new Date(Date.UTC(iAnioUTC, iMesUTC, iDiaUTC, 0, 0, 0, 0));

                    // Normalizar fecha actual a UTC 00:00:00
                    var oFechaNormalizada = new Date(Date.UTC(
                        oFecha.getFullYear(),
                        oFecha.getMonth(),
                        oFecha.getDate(),
                        0, 0, 0, 0
                    ));

                    // Comparar las fechas normalizadas en UTC
                    return oFechaNormalizada.getTime() === oFechaTurnoNormalizada.getTime();
                });

                // Eliminar duplicados basados en Equnr + TurnoAsignado (IGUAL QUE EL EXCEL)
                var aLicenciasUnicas = [];
                var oMapaDuplicados = {};

                aLicenciasFecha.forEach(function (license) {
                    var sEquipo = license.Equnr || "";
                    var sTurno = license.TurnoAsignado || "";
                    var sClave = sEquipo + "|" + sTurno;

                    if (!oMapaDuplicados[sClave]) {
                        oMapaDuplicados[sClave] = true;
                        aLicenciasUnicas.push(license);
                    }
                });

                aLicenciasUnicas.forEach(function (license) {
                    var sEquipo = license.Equnr || "";
                    var sHora = license.TurnoAsignado || (license.Horainicio ? oFormatter.durationToTime(license.Horainicio)
                        : (license.Gdate ? oFormatter.msTohoursSeconds(license.Gdate) : ""));
                    var sComentarios = license.Comments || license.PatAdic || "";

                    aDatosAplanados.push({
                        Fecha: sFechaFormateada,
                        Equipo: sEquipo,
                        Hora: sHora,
                        Comentarios: sComentarios,
                        Licencia: license.Id,
                        FechaOriginal: license.Dateturno
                    });

                });
            }.bind(this));

            return aDatosAplanados;
        },

        _obtenerDatosReporte: function (oDateInicio, oDateFin, sReportType) {
            return new Promise((resolve, reject) => {
                const oDataService = this.getView().getModel();

                // Generar array de fechas
                const aFechas = [];
                const oFechaInicioUTC = new Date(Date.UTC(
                    oDateInicio.getFullYear(),
                    oDateInicio.getMonth(),
                    oDateInicio.getDate(),
                    0, 0, 0, 0
                ));
                const oFechaFinUTC = new Date(Date.UTC(
                    oDateFin.getFullYear(),
                    oDateFin.getMonth(),
                    oDateFin.getDate(),
                    0, 0, 0, 0
                ));

                const oFechaFinLimiteUTC = new Date(oFechaFinUTC);
                oFechaFinLimiteUTC.setUTCDate(oFechaFinLimiteUTC.getUTCDate() + 1);

                const oFechaActualUTC = new Date(oFechaInicioUTC);
                while (oFechaActualUTC < oFechaFinLimiteUTC) {
                    const oFechaNormalizada = new Date(Date.UTC(
                        oFechaActualUTC.getUTCFullYear(),
                        oFechaActualUTC.getUTCMonth(),
                        oFechaActualUTC.getUTCDate(),
                        0, 0, 0, 0
                    ));
                    aFechas.push(oFechaNormalizada);
                    oFechaActualUTC.setUTCDate(oFechaActualUTC.getUTCDate() + 1);
                }

                const sEntity = "/TurnosLicenciasSet";

                // Crear promesas para cada fecha
                const aPromises = aFechas.map((oFecha) => {
                    return new Promise((resolveInner, rejectInner) => {
                        const aFilters = [
                            new Filter("Dateturno", FilterOperator.EQ, oFecha),
                            new Filter("Empresa", FilterOperator.EQ, "100")
                        ];

                        oDataService.read(sEntity, {
                            filters: aFilters,
                            success: (oData) => {
                                resolveInner(oData.results || []);
                            },
                            error: (oError) => {
                                resolveInner([]);
                            }
                        });
                    });
                });

                // Ejecutar todas las promesas
                Promise.all(aPromises)
                    .then((aResultadosPorFecha) => {
                        const aTodosLosResultados = [];
                        aResultadosPorFecha.forEach((aResultados) => {
                            if (Array.isArray(aResultados) && aResultados.length > 0) {
                                aTodosLosResultados.push(...aResultados);
                            }
                        });
                        resolve(aTodosLosResultados);
                    })
                    .catch(reject);
            });
        },


        // Función para descargar el reporte actual (desde la tab)
        onDescargarReporteActual: function () {
            if (!this._reporteFechaInicio || !this._reporteFechaFin) {
                MessageToast.show("No hay datos de reporte cargados");
                return;
            }

            // USAR LOS DATOS PROCESADOS GUARDADOS
            if (!this._datosReporteProcesados || this._datosReporteProcesados.length === 0) {
                MessageToast.show("No hay datos para descargar");
                return;
            }

            this.createExcelReportManiobras(
                this._datosReporteProcesados,
                this._reporteFechaInicio,
                this._reporteFechaFin
            );
        },

        onCerrarReporte: function () {
            var oIconTabBar = this.byId("mainTabBar");
            if (oIconTabBar) {
                // Ocultar la tab del reporte
                var oReporteTab = oIconTabBar.getItems().find(item => item.getKey() === "REPORTE");
                if (oReporteTab) {
                    oReporteTab.setVisible(false);
                }
                // Volver a la primera tab
                oIconTabBar.setSelectedKey("LIC");
            }
        },

        // ------------------------------------------------ DESCRIPCIONES PARA EQUIPOS ------------------------------------------------------------------------
        _obtenerDescripcionesEquipos: function (aEquipos) {
            return new Promise((resolve) => {
                if (!aEquipos || aEquipos.length === 0) {
                    resolve({});
                    return;
                }

                const oDataModel = this.getView().getModel();
                const sEntity = "/EquiposRolesSet";

                const estacionesUnicas = [...new Set(aEquipos.map(e => e.Tplnr).filter(Boolean))];

                const aPromises = estacionesUnicas.map((sTplnr) => {
                    return new Promise((resolveEstacion) => {
                        const aFilters = [
                            new Filter("Estacion", FilterOperator.EQ, sTplnr),
                            new Filter("Rol", FilterOperator.EQ, "hab_Aprobacion_habilitaciones"),
                            new Filter("Empresa", FilterOperator.EQ, "100")
                        ];

                        oDataModel.read(sEntity, {
                            filters: aFilters,
                            success: (oData) => {
                                resolveEstacion(oData.results || []);
                            },
                            error: () => {
                                resolveEstacion([]);
                            }
                        });
                    });
                });

                Promise.all(aPromises)
                    .then((aResultadosPorEstacion) => {
                        const todosLosEquipos = aResultadosPorEstacion.flat();

                        const oMapaDescripciones = {};
                        todosLosEquipos.forEach(equipo => {
                            const sCodigo = (equipo.CodigoEquipo || "").trim();
                            if (sCodigo) {
                                oMapaDescripciones[sCodigo] = equipo.DescEquipo || "";
                            }
                        });

                        resolve(oMapaDescripciones);
                    })
                    .catch(() => {
                        resolve({});
                    });
            });
        },

        // ----------------------------------------------------- ENVIAR ----------------------------------------------------------------

        onSendEmailPress: function () {
            const Fecha = this._oFechaTurnoCreado || this.getView().byId('date').getDateValue();

            if (!Fecha) {
                MessageBox.warning("Debe seleccionar una fecha para enviar el turno.");
                return;
            }

            const oModel = this.getView().getModel("LicencesJsonModel");
            const aAllLicences = oModel.getProperty("/") || [];

            if (!aAllLicences || aAllLicences.length === 0) {
                MessageBox.warning("No hay datos para enviar.");
                return;
            }

            const aLicenciasSinHorario = aAllLicences.filter(lic => {
                const turno = lic.TurnoAsignado;
                return !turno || turno.trim() === "";
            });

            if (aLicenciasSinHorario.length > 0) {
                const sLicenciasDetalle = aLicenciasSinHorario
                    .map(lic => `• Licencia ${lic.Id} (${lic.Equnr || 'Sin equipo'})`)
                    .join("\n");

                MessageBox.error(
                    `No se puede enviar el turno porque hay ${aLicenciasSinHorario.length} licencia(s) sin horario asignado:\n\n${sLicenciasDetalle}\n\nPor favor, asigne un horario a todas las licencias antes de enviar.`,
                    {
                        title: "Horarios sin asignar",
                        styleClass: "sapUiSizeCompact"
                    }
                );
                return;
            }

            const aLicenciasAEnviar = aAllLicences.filter(lic => lic.Enviado !== true);

            if (aLicenciasAEnviar.length === 0) {
                MessageBox.information("Todas las licencias ya fueron enviadas. No hay cambios pendientes.");
                return;
            }

            // Preparar datos SOLO de las licencias a enviar
            const aData = [];
            aLicenciasAEnviar.forEach(function (oRowData) {
                const row = {
                    Id: oRowData.Id,
                    Empresa: oRowData.Empresa,
                    Tipo: oRowData.Tipo,
                    Anio: oRowData.Anio,
                    Fecha: Fecha,
                    Turno: oRowData.TurnoAsignado,
                    Comentarios: oRowData.Comentarios,
                    Enviado: true
                };
                aData.push(row);
            });

            this.createTurno(aData, aLicenciasAEnviar, true);
        },

        //-------------------------------------------- ADJUNTAR EN TAB ACCIONES  ------------------------------------------------

        onAttachFileAccion: function (oEvent) {
            // Guardar el contexto de la acción
            this._currentAccionAttachmentContext = oEvent.getSource().getBindingContext("AccionesEntregaModel");

            if (!this._currentAccionAttachmentContext) {
                MessageToast.show("No se pudo obtener la acción");
                return;
            }

            const oAccion = this._currentAccionAttachmentContext.getObject();

            // Crear input de archivo si no existe
            if (!this._fileInputAccion) {
                this._fileInputAccion = document.createElement("input");
                this._fileInputAccion.type = "file";
                this._fileInputAccion.accept = ".pdf,.doc,.docx,.xls,.xlsx,.jpg,.jpeg,.png,.txt";
                this._fileInputAccion.style.display = "none";

                this._fileInputAccion.addEventListener("change", function (e) {
                    this._handleFileSelectionAccion(e);
                }.bind(this));

                document.body.appendChild(this._fileInputAccion);
            }

            this._fileInputAccion.value = null;
            this._fileInputAccion.click();
        },


        _handleFileSelectionAccion: function (oEvent) {
            const file = oEvent.target.files[0];

            if (!file) {
                return;
            }

            const maxSize = 10 * 1024 * 1024; // 10MB
            if (file.size > maxSize) {
                MessageBox.error("El archivo es demasiado grande. Máximo 10MB");
                return;
            }

            // Convertir a base64
            this._convertFileToBase64Accion(file);
        },

        _convertFileToBase64Accion: function (file) {
            const reader = new FileReader();

            reader.onload = function (e) {
                const base64String = e.target.result;

                if (this._currentAccionAttachmentContext) {
                    const oAccion = this._currentAccionAttachmentContext.getObject();

                    // Inicializar array de adjuntos si no existe
                    if (!oAccion.Attachments) {
                        oAccion.Attachments = [];
                    }

                    // Obtener fecha del turno
                    const oFechaTurno = this._oFechaTurnoCreado || this.byId("date").getDateValue();

                    // Crear nuevo adjunto con estructura de CatalogoEntregasSet
                    const nuevoAdjunto = {
                        // Keys
                        Id: oAccion.idLicencia,
                        Empresa: "100",
                        Tipo: "L",
                        Anio: new Date().getFullYear().toString(),
                        Dateturno: oFechaTurno,
                        Codigo: oAccion.accion || "",

                        // Campos adicionales
                        Descripcion: oAccion.descripcion || "",
                        Equnr: oAccion.equipo || "",
                        Jobcond: oAccion.condicion || "",
                        Turnoentrega: oAccion.turnoEntrega || "",
                        Comments: "",
                        Licstat: oAccion.estado || "",
                        Attachment: base64String.split(',')[1],

                        // Metadata para UI
                        AttachmentName: file.name,
                        AttachmentSize: file.size,
                        AttachmentType: file.type,
                        Timestamp: new Date().getTime()
                    };

                    oAccion.Attachments.push(nuevoAdjunto);

                    // Refrescar modelo
                    const oModel = this.getView().getModel("AccionesEntregaModel");
                    oModel.refresh(true);

                    MessageToast.show("Archivo agregado: " + file.name);
                }
            }.bind(this);

            reader.onerror = function () {
                MessageBox.error("Error al leer el archivo");
            };

            reader.readAsDataURL(file);
        },

        onViewAttachmentAccion: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("AccionesEntregaModel");

            if (!oContext) {
                MessageToast.show("No se pudo obtener la acción");
                return;
            }

            const oAccion = oContext.getObject();

            // Verificar si hay adjuntos
            if (!oAccion.Attachments || oAccion.Attachments.length === 0) {
                MessageToast.show("No hay archivos adjuntos");
                return;
            }

            this._showAttachmentSelectorAccion(oAccion, oContext);
        },

        _showAttachmentSelectorAccion: function (oAccion, oContext) {
            const oView = this.getView();

            // Guardar el contexto
            this._currentAccionAttachmentContext = oContext;
            this._currentAccionForAttachments = oAccion;

            // Destruir diálogo anterior si existe
            if (this._attachmentSelectorDialogAccion) {
                this._attachmentSelectorDialogAccion.destroy();
                this._attachmentSelectorDialogAccion = null;
            }

            const oList = new sap.m.List({
                mode: "None",
                items: {
                    path: "/attachments",
                    template: new sap.m.CustomListItem({
                        content: [
                            new sap.m.HBox({
                                justifyContent: "SpaceBetween",
                                alignItems: "Center",
                                items: [
                                    new sap.m.HBox({
                                        alignItems: "Center",
                                        items: [
                                            new sap.ui.core.Icon({
                                                src: "{icon}",
                                                size: "2rem",
                                                color: "#0854a0"
                                            }).addStyleClass("sapUiSmallMarginEnd"),
                                            new sap.m.VBox({
                                                items: [
                                                    new sap.m.Text({
                                                        text: "{name}",
                                                        maxLines: 1
                                                    }).addStyleClass("sapUiSmallMarginBottom"),
                                                    new sap.m.Text({
                                                        text: "{info}",
                                                        maxLines: 1
                                                    }).addStyleClass("sapUiTinyText")
                                                ]
                                            })
                                        ]
                                    }),
                                    // Botones de acción
                                    new sap.m.HBox({
                                        justifyContent: "End",
                                        alignItems: "Center",
                                        items: [
                                            // Botón Ver
                                            new sap.m.Button({
                                                icon: "sap-icon://show",
                                                type: "Emphasized",
                                                tooltip: "Ver archivo",
                                                press: function (oEvent) {
                                                    const oItem = oEvent.getSource().getParent().getParent().getParent();
                                                    const iIndex = oList.indexOfItem(oItem);
                                                    const oAttachment = oAccion.Attachments[iIndex];
                                                    this._openAttachmentAccion(oAttachment);
                                                }.bind(this)
                                            }).addStyleClass("sapUiTinyMarginEnd"),

                                            // Botón Eliminar
                                            new sap.m.Button({
                                                icon: "sap-icon://delete",
                                                type: "Reject",
                                                tooltip: "Eliminar archivo",
                                                press: function (oEvent) {
                                                    const oItem = oEvent.getSource().getParent().getParent().getParent();
                                                    const iIndex = oList.indexOfItem(oItem);
                                                    const oAttachment = oAccion.Attachments[iIndex];
                                                    this._deleteAttachmentFromListAccion(oAttachment, iIndex);
                                                }.bind(this)
                                            })
                                        ]
                                    })
                                ]
                            }).addStyleClass("sapUiSmallMargin")
                        ]
                    })
                }
            });

            const aListData = oAccion.Attachments.map((att, idx) => ({
                name: att.AttachmentName,
                info: this._formatSize(att.AttachmentSize) + " • " + this._getFileTypeName(att.AttachmentType),
                icon: this.getFileIcon(att.AttachmentType),
                index: idx
            }));

            const oDialogModel = new sap.ui.model.json.JSONModel({
                attachments: aListData
            });

            this._attachmentSelectorDialogAccion = new sap.m.Dialog({
                title: "Archivos Adjuntos - Acción: " + oAccion.accion,
                contentWidth: "850px",
                contentHeight: "500px",
                resizable: true,
                draggable: true,
                content: [oList],
                beginButton: new sap.m.Button({
                    text: "Cerrar",
                    press: function () {
                        this._attachmentSelectorDialogAccion.close();
                    }.bind(this)
                }),
                afterClose: function () {
                    this._attachmentSelectorDialogAccion.destroy();
                    this._attachmentSelectorDialogAccion = null;
                }.bind(this)
            });

            // Establecer modelo
            this._attachmentSelectorDialogAccion.setModel(oDialogModel);

            // Agregar a la vista
            oView.addDependent(this._attachmentSelectorDialogAccion);

            // Abrir
            this._attachmentSelectorDialogAccion.open();
        },

        _downloadAttachmentAccion: function (oAttachment) {
            try {
                // Reconstruir data URL completa si es necesario
                let dataUrl = oAttachment.Attachment;

                // Si no tiene el prefijo data:, agregarlo
                if (!dataUrl.startsWith('data:')) {
                    const mimeType = oAttachment.AttachmentType || 'application/octet-stream';
                    dataUrl = `data:${mimeType};base64,${dataUrl}`;
                }

                const link = document.createElement('a');
                link.href = dataUrl;
                link.download = oAttachment.AttachmentName;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);

                MessageToast.show("Descargando: " + oAttachment.AttachmentName);
            } catch (error) {
                MessageBox.error("Error al descargar el archivo");
            }
        },

        _deleteAttachmentFromListAccion: function (oAttachment, iIndex) {
            MessageBox.confirm(
                "¿Desea eliminar el archivo '" + oAttachment.AttachmentName + "'?",
                {
                    title: "Confirmar eliminación",
                    actions: [MessageBox.Action.DELETE, MessageBox.Action.CANCEL],
                    emphasizedAction: MessageBox.Action.DELETE,
                    onClose: function (sAction) {
                        if (sAction === MessageBox.Action.DELETE) {
                            this._deleteAttachmentAccion(oAttachment, iIndex);
                        }
                    }.bind(this)
                }
            );
        },

        _deleteAttachmentAccion: function (oAttachment, iIndex) {
            const oAccion = this._currentAccionForAttachments;

            if (!oAccion || !oAccion.Attachments) {
                MessageToast.show("Error: No se pudo encontrar la acción");
                return;
            }

            const tieneKeysBackend = oAttachment.Id && oAttachment.Empresa &&
                oAttachment.Tipo && oAttachment.Anio &&
                oAttachment.Dateturno && oAttachment.Codigo;

            if (tieneKeysBackend) {
                this.showGlobalBusy("Eliminando adjunto...");

                const oDataService = this.getView().getModel();

                const sKey = oDataService.createKey("/CatalogoEntregaSet", {
                    Id: oAttachment.Id,
                    Empresa: oAttachment.Empresa,
                    Tipo: oAttachment.Tipo,
                    Anio: oAttachment.Anio,
                    Dateturno: oAttachment.Dateturno,
                    Codigo: oAttachment.Codigo
                });

                oDataService.remove(sKey, {
                    success: () => {
                        oAccion.Attachments.splice(iIndex, 1);

                        const oModel = this.getView().getModel("AccionesEntregaModel");
                        oModel.updateBindings(true);

                        if (this._attachmentSelectorDialogAccion) {
                            this._attachmentSelectorDialogAccion.close();
                        }

                        MessageToast.show("Archivo eliminado: " + oAttachment.AttachmentName);

                        this.onGuardarAccionesBackend();
                    },
                    error: (oError) => {
                        this.hideGlobalBusy();
                        MessageBox.error("Error al eliminar el archivo del backend. Intente nuevamente.");
                    }
                });

            } else {
                oAccion.Attachments.splice(iIndex, 1);

                const oModel = this.getView().getModel("AccionesEntregaModel");
                oModel.updateBindings(true);

                MessageToast.show("Archivo eliminado: " + oAttachment.AttachmentName);

                // Cerrar diálogo
                if (this._attachmentSelectorDialogAccion) {
                    this._attachmentSelectorDialogAccion.close();
                }

                if (oAccion.Attachments.length === 0) {
                    MessageToast.show("Todos los archivos fueron eliminados. Recuerde guardar los cambios.");
                }
            }
        },

        _openAttachmentAccion: function (oAttachment) {
            const sType = oAttachment.AttachmentType;

            let sDataUrl = oAttachment.Attachment;

            if (!sDataUrl.startsWith('data:')) {
                const mimeType = sType || 'application/octet-stream';
                sDataUrl = `data:${mimeType};base64,${sDataUrl}`;
            }

            // Para PDFs
            if (sType === "application/pdf") {
                this._openPDFViewer(sDataUrl);
                return;
            }

            // Para imágenes 
            if (sType && sType.startsWith("image/")) {
                // Crear objeto compatible con _openImageViewer
                const oImageAttachment = {
                    AttachmentData: sDataUrl,
                    AttachmentName: oAttachment.AttachmentName
                };
                this._openImageViewer(oImageAttachment);
                return;
            }

            // Para otros archivos, descargar
            this._downloadAttachmentAccion(oAttachment);
        },

        // ------------------------ AGREGAR LICENCIAS SIN FILTRO DE ESTADO ------------------------

        onAgregarLicencia: function (oEvent) {
            const oView = this.getView();

            // Obtener fecha seleccionada
            const oDatePicker = this.byId("date");
            const oFechaSeleccionada = oDatePicker.getDateValue();

            if (!oFechaSeleccionada) {
                MessageBox.warning("Por favor, seleccione una fecha primero.");
                return;
            }

            // Mostrar busy
            this.showGlobalBusy("Cargando licencias disponibles...");

            // Cargar licencias sin filtro de estado
            this._cargarLicenciasDisponibles(oFechaSeleccionada)
                .then((aLicencias) => {
                    this.hideGlobalBusy();

                    if (aLicencias.length === 0) {
                        MessageBox.information("No hay licencias disponibles para esta fecha.");
                        return;
                    }

                    // Crear/Abrir fragment
                    this._mostrarDialogoAgregarLicencias(aLicencias);
                })
                .catch((error) => {
                    this.hideGlobalBusy();
                    MessageBox.error("Error al cargar las licencias disponibles.");
                });
        },

        _cargarLicenciasDisponibles: function (oFecha) {
            return new Promise((resolve, reject) => {
                const oDataModel = this.getView().getModel();

                // Filtros: Solo fecha y empresa, SIN filtro de estado
                const aFilters = [
                    new Filter("Solbeg", FilterOperator.LE, oFecha),
                    new Filter("Solend", FilterOperator.GE, oFecha),
                    new Filter("Empresa", FilterOperator.EQ, "100"),
                    new Filter("Tipo", FilterOperator.EQ, "L")
                ];


                oDataModel.read('/LicenciaTrabajoSet', {
                    filters: aFilters,
                    success: (oData) => {
                        const aLicencias = oData.results || [];

                        // Filtrar solo las que ya NO están en la tabla
                        const aLicenciasFiltradas = this._filtrarLicenciasYaAgregadas(aLicencias);

                        resolve(aLicenciasFiltradas);
                    },
                    error: (oError) => {
                        reject(oError);
                    }
                });
            });
        },

        _filtrarLicenciasYaAgregadas: function (aLicencias) {
            const oLicencesModel = this.getView().getModel("LicencesJsonModel");
            const aLicenciasActuales = oLicencesModel.getData() || [];

            // Set de IDs ya agregados
            const setIdsActuales = new Set(aLicenciasActuales.map(l => l.Id));

            // Filtrar las que NO están
            const aDisponibles = aLicencias.filter(lic => !setIdsActuales.has(lic.Id));

            return aDisponibles;
        },

        _mostrarDialogoAgregarLicencias: function (aLicencias) {
            const oView = this.getView();

            // Crear modelo para el diálogo
            const oAgregarLicenciaModel = new sap.ui.model.json.JSONModel(aLicencias);
            oView.setModel(oAgregarLicenciaModel, "AgregarLicenciaModel");

            // Cargar fragment si no existe
            if (!this._dialogAgregarLicencia) {
                Fragment.load({
                    id: oView.getId(),
                    name: "transener.sistemadeturnos.fragments.agregarLicenciaDisponible",
                    controller: this
                }).then((oDialog) => {
                    this._dialogAgregarLicencia = oDialog;
                    oView.addDependent(oDialog);
                    oDialog.open();
                });
            } else {
                this._dialogAgregarLicencia.open();
            }
        },

        onSearchAgregarLicencia: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue") || "";
            const oTable = this.byId("tablaAgregarLicencias");
            const oBinding = oTable.getBinding("items");

            if (!oBinding) return;

            const aFilters = [];

            if (sQuery) {
                aFilters.push(new Filter({
                    filters: [
                        new Filter("Id", FilterOperator.Contains, sQuery),
                        new Filter("Equnr", FilterOperator.Contains, sQuery),
                        new Filter("Comments", FilterOperator.Contains, sQuery),
                        new Filter("Licstat", FilterOperator.Contains, sQuery)
                    ],
                    and: false
                }));
            }

            oBinding.filter(aFilters);

        },

        onConfirmarAgregarLicencias: function () {
            const oTable = this.byId("tablaAgregarLicencias");
            const aSelectedItems = oTable.getSelectedItems();

            if (aSelectedItems.length === 0) {
                MessageBox.warning("Por favor, seleccione al menos una licencia.");
                return;
            }

            // Obtener las licencias seleccionadas
            const aLicenciasSeleccionadas = aSelectedItems.map(item => {
                return item.getBindingContext("AgregarLicenciaModel").getObject();
            });

            // Mostrar busy
            this.showGlobalBusy("Procesando licencias...");

            this._procesarLicenciasAntesDeAgregar(aLicenciasSeleccionadas)
                .then((aLicenciasProcesadas) => {

                    // MARCAR como agregadas manualmente
                    aLicenciasProcesadas.forEach(lic => {
                        lic.Agrmanual = true;
                    });

                    // Agregar a la tabla
                    TurnosService.appendLicencesToModel(aLicenciasProcesadas, this.getView());

                    this.hideGlobalBusy();

                    // Mensaje de éxito
                    MessageToast.show(`${aLicenciasProcesadas.length} licencia(s) agregada(s) correctamente`);

                    // Cerrar diálogo
                    this._dialogAgregarLicencia.close();

                    // Limpiar selección
                    oTable.removeSelections();
                })
                .catch((error) => {
                    this.hideGlobalBusy();
                    MessageBox.error("Error al procesar las licencias.");
                });
        },

        _procesarLicenciasAntesDeAgregar: function (aLicencias) {
            return new Promise((resolve, reject) => {
                const oView = this.getView();

                // 1. Obtener descripciones de equipos
                this._obtenerDescripcionesEquiposParaLicencias(aLicencias)
                    .then((aLicenciasConDescripciones) => {

                        // 2. Asignar consolas
                        const aLicenciasCompletas = this._asignarConsolasALicencias(aLicenciasConDescripciones);

                        resolve(aLicenciasCompletas);
                    })
                    .catch((error) => {

                        // Si falla, al menos asignar consolas
                        const aLicenciasConConsola = this._asignarConsolasALicencias(aLicencias);
                        resolve(aLicenciasConConsola);
                    });
            });
        },

        _obtenerDescripcionesEquiposParaLicencias: function (aLicencias) {
            // Extraer combinaciones únicas de Equnr + Tplnr
            const aEquiposUnicos = aLicencias
                .map(item => ({
                    Equnr: (item.Equnr || "").trim(),
                    Tplnr: (item.Tplnr || "").trim()
                }))
                .filter(item => item.Equnr && item.Tplnr);

            // Deduplicar
            const aEquiposUnicosDedup = Array.from(
                new Map(aEquiposUnicos.map(item => [JSON.stringify(item), item])).values()
            );

            if (aEquiposUnicosDedup.length === 0) {
                return Promise.resolve(aLicencias);
            }

            // Llamar a la función existente
            return this._obtenerDescripcionesEquipos(aEquiposUnicosDedup)
                .then((oDescripcionesEquipos) => {

                    // Agregar descripciones a las licencias
                    aLicencias.forEach(lic => {
                        const sEquipoNormalizado = (lic.Equnr || "").trim();
                        lic.DescEquipo = oDescripcionesEquipos[sEquipoNormalizado] || "";
                        lic.EquipoCompleto = lic.DescEquipo
                            ? lic.Equnr + " - " + lic.DescEquipo
                            : lic.Equnr;
                    });

                    return aLicencias;
                });
        },

        _asignarConsolasALicencias: function (aLicencias) {
            const oView = this.getView();
            const oConsolasModel = ModelHelper.getModel("consolasModel", oView);

            if (!oConsolasModel) {
                return aLicencias;
            }

            const oConsolasData = oConsolasModel.getData();

            if (!oConsolasData || typeof oConsolasData !== "object") {
                return aLicencias;
            }

            // Asignar consola a cada licencia
            aLicencias.forEach((licencia) => {
                for (const grupo in oConsolasData) {
                    const consolas = oConsolasData[grupo];

                    if (Array.isArray(consolas)) {
                        const consolaEncontrada = consolas.find((consola) => consola === licencia.Tplnr);

                        if (consolaEncontrada) {
                            licencia.Consola = grupo;
                            break;
                        }
                    }
                }

                // Si no se encontró consola, asignar vacío
                if (!licencia.Consola) {
                    licencia.Consola = "";
                }
            });

            return aLicencias;
        },

        onCancelarAgregarLicencias: function () {
            if (this._dialogAgregarLicencia) {
                this._dialogAgregarLicencia.close();

                // Limpiar selección
                const oTable = this.byId("tablaAgregarLicencias");
                if (oTable) {
                    oTable.removeSelections();
                }
            }
        },

        _saveAccionesEnBackend: function (aAcciones, timestampOData) {
            const oDataService = this.getView().getModel();
            const sEntity = "/CatalogoEntregaSet";

            if (aAcciones.length === 0) {
                return Promise.resolve();
            }

            const aPromises = [];

            aAcciones.forEach(accion => {
                const bExisteEnBackend = accion._licenciaId && accion.idLicencia && accion.accion;

                if (accion.Attachments && accion.Attachments.length > 0) {
                    // Procesar cada adjunto
                    accion.Attachments.forEach((att, idx) => {
                        const bAdjuntoExiste = att.Id && att.Empresa && att.Tipo && att.Anio && att.Dateturno && att.Codigo;

                        aPromises.push(
                            new Promise((resolve, reject) => {
                                let base64Data = att.Attachment || "";
                                if (base64Data.includes(',')) {
                                    base64Data = base64Data.split(',')[1];
                                }

                                const payload = {
                                    Id: accion.idLicencia,
                                    Empresa: accion.empresa || "100",
                                    Tipo: accion.tipo || "L",
                                    Anio: accion.anio || new Date().getFullYear().toString(),
                                    Dateturno: timestampOData,
                                    Codigo: (accion.accion || "").substring(0, 10),
                                    Accion: (accion.descripcion || "Sin descripción").substring(0, 100),
                                    Descripcion: accion.trabajoRealizar || "Sin descripción",
                                    Equnr: (accion.equipo || "").substring(0, 18),
                                    Equstat: accion.equstat || "A",
                                    Jobcond: (accion.condicion || "01").substring(0, 2),
                                    Turnoentrega: (accion.turnoEntrega || "").substring(0, 6),
                                    Comments: (att.AttachmentName || `Adjunto ${idx + 1}`).substring(0, 255),
                                    Licstat: (accion.estado || "01").substring(0, 2),
                                    Attachment: base64Data
                                };

                                if (bAdjuntoExiste) {
                                    const sKey = oDataService.createKey(sEntity, {
                                        Id: att.Id,
                                        Empresa: att.Empresa,
                                        Tipo: att.Tipo,
                                        Anio: att.Anio,
                                        Dateturno: att.Dateturno,
                                        Codigo: att.Codigo
                                    });

                                    oDataService.update(sKey, payload, {
                                        success: () => {
                                            resolve();
                                        },
                                        error: (oError) => {
                                            // Intentar crear si falla el update
                                            oDataService.create(sEntity, payload, {
                                                success: () => {
                                                    resolve();
                                                },
                                                error: () => {
                                                    resolve();
                                                }
                                            });
                                        }
                                    });
                                } else {
                                    oDataService.create(sEntity, payload, {
                                        success: () => {
                                            resolve();
                                        },
                                        error: (oError) => {
                                            const isDuplicado = oError.responseText &&
                                                oError.responseText.includes("ya existe");

                                            if (isDuplicado) {
                                                const sKey = oDataService.createKey(sEntity, {
                                                    Id: payload.Id,
                                                    Empresa: payload.Empresa,
                                                    Tipo: payload.Tipo,
                                                    Anio: payload.Anio,
                                                    Dateturno: payload.Dateturno,
                                                    Codigo: payload.Codigo
                                                });

                                                oDataService.update(sKey, payload, {
                                                    success: () => {
                                                        resolve();
                                                    },
                                                    error: () => {
                                                        resolve();
                                                    }
                                                });
                                            } else {
                                                resolve();
                                            }
                                        }
                                    });
                                }
                            })
                        );
                    });

                } else {

                    aPromises.push(
                        new Promise((resolve, reject) => {
                            const payload = {
                                Id: accion.idLicencia,
                                Empresa: accion.empresa || "100",
                                Tipo: accion.tipo || "L",
                                Anio: accion.anio || new Date().getFullYear().toString(),
                                Dateturno: timestampOData,
                                Codigo: (accion.accion || "").substring(0, 10),
                                Accion: (accion.descripcion || "Sin descripción").substring(0, 100),
                                Descripcion: accion.trabajoRealizar || "Sin descripción",
                                Equnr: (accion.equipo || "").substring(0, 18),
                                Equstat: accion.equstat || "A",
                                Jobcond: (accion.condicion || "01").substring(0, 2),
                                Turnoentrega: (accion.turnoEntrega || "").substring(0, 6),
                                Comments: "Sin adjuntos",
                                Licstat: (accion.estado || "01").substring(0, 2),
                                Attachment: ""
                            };

                            if (bExisteEnBackend) {
                                const sKey = oDataService.createKey(sEntity, {
                                    Id: accion.idLicencia,
                                    Empresa: accion.empresa || "100",
                                    Tipo: accion.tipo || "L",
                                    Anio: accion.anio || new Date().getFullYear().toString(),
                                    Dateturno: timestampOData,
                                    Codigo: accion.accion
                                });

                                oDataService.update(sKey, payload, {
                                    success: () => {
                                        resolve();
                                    },
                                    error: (oError) => {
                                        oDataService.create(sEntity, payload, {
                                            success: () => {
                                                resolve();
                                            },
                                            error: (oError2) => {
                                                resolve();
                                            }
                                        });
                                    }
                                });
                            } else {
                                oDataService.create(sEntity, payload, {
                                    success: () => {
                                        resolve();
                                    },
                                    error: (oError) => {
                                        const isDuplicado = oError.responseText &&
                                            oError.responseText.includes("ya existe");

                                        if (isDuplicado) {
                                            const sKey = oDataService.createKey(sEntity, {
                                                Id: payload.Id,
                                                Empresa: payload.Empresa,
                                                Tipo: payload.Tipo,
                                                Anio: payload.Anio,
                                                Dateturno: payload.Dateturno,
                                                Codigo: payload.Codigo
                                            });

                                            oDataService.update(sKey, payload, {
                                                success: () => {
                                                    resolve();
                                                },
                                                error: () => {
                                                    resolve();
                                                }
                                            });
                                        } else {
                                            resolve();
                                        }
                                    }
                                });
                            }
                        })
                    );
                }
            });

            return Promise.all(aPromises);
        },

        _convertODataTimestampToDate: function (timestampOData) {
            if (!timestampOData) return null;

            // Extraer el número del formato /Date(1769040000000)/
            const match = timestampOData.match(/\/Date\((\d+)\)\//);
            if (match && match[1]) {
                return new Date(parseInt(match[1]));
            }

            return null;
        },

        _cargarAccionesDesdeBackend: function (oFecha) {
            return new Promise((resolve) => {
                const oDataService = this.getView().getModel();

                if (!oFecha) {
                    resolve();
                    return;
                }

                const year = oFecha.getFullYear();
                const month = oFecha.getMonth();
                const day = oFecha.getDate();
                const oFechaUTC = new Date(Date.UTC(year, month, day, 0, 0, 0, 0));

                const aFilters = [
                    new Filter("Dateturno", FilterOperator.EQ, oFechaUTC),
                    new Filter("Empresa", FilterOperator.EQ, "100")
                ];

                oDataService.read("/CatalogoEntregaSet", {
                    filters: aFilters,
                    success: (oData) => {
                        const aResultados = oData.results || [];

                        if (aResultados.length > 0) {
                            this._procesarAccionesCargadas(aResultados);
                        }

                        resolve();
                    },
                    error: () => {
                        resolve();
                    }
                });
            });
        },

        _procesarAccionesCargadas: function (aResultados) {
            const oView = this.getView();
            const oAccionesModel = oView.getModel("AccionesEntregaModel");

            const mAccionesAgrupadas = {};

            aResultados.forEach(item => {
                const sKey = `${item.Id}_${item.Codigo}`;

                if (!mAccionesAgrupadas[sKey]) {
                    mAccionesAgrupadas[sKey] = {
                        accion: item.Codigo,
                        descripcion: item.Accion || "",
                        equipo: item.Equnr || "",
                        idLicencia: item.Id,
                        trabajoRealizar: item.Descripcion || "Sin descripción",
                        turnoEntrega: item.Turnoentrega || "",
                        estado: item.Licstat || "",
                        condicion: item.Jobcond || "",
                        equstat: item.Equstat || "A",
                        empresa: item.Empresa || "100",
                        tipo: item.Tipo || "L",
                        anio: item.Anio || "",
                        _licenciaId: item.Id,
                        Attachments: []
                    };
                }

                const esSinAdjuntos = (item.Comments || "").toLowerCase().includes("sin adjunto");

                if (item.Attachment && item.Attachment.trim() !== "" && !esSinAdjuntos) {
                    mAccionesAgrupadas[sKey].Attachments.push({
                        Id: item.Id,
                        Empresa: item.Empresa,
                        Tipo: item.Tipo,
                        Anio: item.Anio,
                        Dateturno: item.Dateturno,
                        Codigo: item.Codigo,
                        Descripcion: item.Descripcion || "",
                        Equnr: item.Equnr || "",
                        Equstat: item.Equstat || "",
                        Jobcond: item.Jobcond || "",
                        Turnoentrega: item.Turnoentrega || "",
                        Comments: item.Comments || "",
                        Licstat: item.Licstat || "",
                        Attachment: item.Attachment,
                        AttachmentName: item.Comments || "Adjunto",
                        AttachmentSize: Math.floor((item.Attachment.length * 3) / 4),
                        AttachmentType: this._inferirTipoArchivo(item.Attachment),
                        Timestamp: new Date().getTime()
                    });
                }
            });

            const aAcciones = Object.values(mAccionesAgrupadas);

            oAccionesModel.setData(aAcciones);
            oAccionesModel.refresh(true);

            if (aAcciones.length > 0) {
                MessageToast.show(`${aAcciones.length} acción(es) cargada(s)`);
            }
        },

        _inferirTipoArchivo: function (base64) {
            if (!base64) return "application/octet-stream";

            if (base64.startsWith("JVBERi")) return "application/pdf";
            if (base64.startsWith("/9j/")) return "image/jpeg";
            if (base64.startsWith("iVBORw")) return "image/png";
            if (base64.startsWith("UEsD")) return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

            return "application/octet-stream";
        },

        //-------------- ACCIONES DESDE SERVIDOR ----------------------------------
        _cargarCatalogoCodigosDesdeBackend: function () {
            // Usar getOwnerComponent() en lugar de getView()
            const oModel = this.getOwnerComponent().getModel();

            if (!oModel) {
                MessageBox.error("No se pudo cargar el modelo OData");
                return;
            }

            oModel.read("/CatalogoCodigosSet", {
                success: (oData) => {
                    const aResultados = oData.results || [];

                    // Crear o actualizar el modelo JSON
                    let oCatalogoModel = this.getView().getModel("CatalogoCodigosModel");

                    if (!oCatalogoModel) {
                        // Si no existe, crear el modelo
                        oCatalogoModel = new JSONModel();
                        this.getView().setModel(oCatalogoModel, "CatalogoCodigosModel");
                    }

                    // Setear los datos en el modelo
                    oCatalogoModel.setData(aResultados);
                    oCatalogoModel.refresh(true);
                },
                error: (oError) => {
                    MessageBox.error("Error al cargar el catálogo de códigos");
                }
            });
        },
    });
});
