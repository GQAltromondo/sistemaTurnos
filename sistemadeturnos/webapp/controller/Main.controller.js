sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "transener/sistemadeturnos/utils/ModelHelper",
    "transener/sistemadeturnos/utils/FormatHelper",
    "transener/sistemadeturnos/services/LicenseService",
    "transener/sistemadeturnos/services/TurnosService",
    "transener/sistemadeturnos/services/WorkflowService",


], function (Controller, MessageToast, MessageBox, Filter, FilterOperator, Fragment,
    //utils
    ModelHelper, FormatHelper,
    //services
    LicenseService, TurnosService, WorkflowService
) {
    "use strict";
    var oDialog = null
    return Controller.extend("transener.sistemadeturnos.controller.Main", {
        formatter: FormatHelper,

        onInit: function () {
            const oView = this.getView()
            this._pBusyDialog = null; // promesa del fragment
            this.getVersion();
            this.getBaseURL();
            ModelHelper.getModel("LicencesJsonModel", oView)
            this.cargarModelos()

            this.getView().setModel(
                new sap.ui.model.json.JSONModel({
                    initialContext: JSON.stringify(
                        { someProperty: "some value", "Destinatario": "gq4dev@gmail.com" },
                        null,
                        4
                    ),
                    apiResponse: "",
                })
            );
        },
        cargarModelos: function () {
            const oView = this.getView()
            ModelHelper.getModel("HorarioLicenciaJsonModel", oView);
            ModelHelper.getModel("consolasModel", oView)
            ModelHelper.getModel("LocalFilterJsonModel", oView);
            ModelHelper.getModel("ColorModel", oView).setProperty("/Color", "white");
            ModelHelper.getModel("consolasModel", oView).loadData("model/ConsolasModel.json", "", false);
            ModelHelper.getModel("enabledModel", oView).loadData("model/EnabledModel.json", "", false);
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

        getBaseURL: function () {
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
        },
        onSelectTurno: function (oEvent) {
            // Mostrar Busy global
            this.showGlobalBusy("Buscando turnos creados…");
            const oView = this.getView()
            const oDataService = this.getView().getModel();

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
                    console.log(oData);

                    this.successSelectTurno(oData)
                        .catch((err) => {
                            console.error("Error en successSelectTurno:", err);
                        })
                        .finally(() => {
                            this.hideGlobalBusy();
                        });
                },
                error: (oError) => {
                    console.error(oError);

                    const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
                    oLicencesModel.setData([]);
                    this.onCountItems([]);
                    this.hideGlobalBusy();
                }
            });
        },
        onSearch: function () {
            var dateTurno = this.byId("date");
            var oTable = this.byId("turnosTable");

            var oDateValue = dateTurno.getDateValue();

            if (!oDateValue) {
                sap.m.MessageToast.show("Seleccione una fecha");
                return;
            }


            const FechaTurno = oDateValue;

            var oLicencesModel = ModelHelper.getModel("LicencesJsonModel", this.getView());
            oLicencesModel.setData([]);
            oTable.setBusy(true);


            TurnosService.search({ FechaTurno, oView: this.getView(), isRefresh: false })
                .then((data) => {
                    oLicencesModel.setData(data);
                    oLicencesModel.refresh();
                    oTable.setBusy(false);
                    this.onCountItems(data);
                })
                .catch((error) => {
                    console.error("Error en la búsqueda:", error);
                    oLicencesModel.setData([]);
                    oLicencesModel.refresh();
                    oTable.setBusy(false);
                });

            this.closeDialog();
        },


        successSelectTurno: async function (data) {
            const oView = this.getView()
            const oLicencesModel = ModelHelper.getModel("LicencesJsonModel", oView);
            const oDataModel = this.getView().getModel();

            try {
                const aResults = Array.isArray(data?.results) ? data.results : [];

                if (!aResults.length) {
                    oLicencesModel.setData([]);
                    this.onCountItems([]);
                    return;
                }

                // Buscar una licencia por vez (sin Promise.all)
                const results = [];
                for (const licencia of aResults) {
                    try {
                        const licData = await LicenseService.FIND(licencia, oDataModel);
                        results.push(licData);
                    } catch (err) {
                        // Si querés seguir aunque falle una licencia:
                        console.error("Error en FIND para licencia", licencia, err);
                        // Si en vez de seguir querés cortar, podés hacer: throw err;
                    }
                }

                if (!results.length) {
                    oLicencesModel.setData([]);
                    this.onCountItems([]);
                    return;
                }

                // Procesar lógica de negocio
                const arrayOrdenado = TurnosService.encontrarGrupo(
                    TurnosService.ordenarPorEqunr(results), this.getView()
                );

                TurnosService.assignShiftsToLicences(arrayOrdenado);

                console.log(oLicencesModel)
                // Actualizar modelo
                oLicencesModel.setData(arrayOrdenado);

                // Contador
                this.onCountItems(arrayOrdenado);

            } catch (error) {
                console.error("Error en successSelectTurno:", error);
                oLicencesModel.setData([]);
                this.onCountItems([]);
                // OJO: acá ya no llamamos hideGlobalBusy
            }
        },


        onCountItems: function (data) {
            let countLTWithManouvers = 0;
            let countLTWithoutManouvers = 0;
            let countTCT = 0;

            data.forEach(item => {
                if (item.Jobcond === "01" || item.Jobcond === "02" || item.Jobcond === "04") {
                    countLTWithManouvers++;
                } else if (item.Jobcond === "05") {
                    countLTWithoutManouvers++;
                } else if (item.Jobcond === "03" || item.Jobcond === "06") {
                    countTCT++;
                }
            });

            const totalCount = countLTWithManouvers + countLTWithoutManouvers + countTCT;

            // Crear un modelo con los resultados
            const counts = {
                LTWithManouvers: countLTWithManouvers,
                LTWithoutManouvers: countLTWithoutManouvers,
                TCT: countTCT,
                Total: totalCount
            };
            console.log(counts)
            // Asignar el modelo al View
            const oModel = new sap.ui.model.json.JSONModel(counts);
            this.getView().setModel(oModel, "countsModel");
        },
        onChangeHour: function (oEvent) {
            // Obtener el contexto de la fila seleccionada
            var oSource = oEvent.getSource();
            var sPath = oSource.getBindingContext("LicencesJsonModel").getPath();
            var iLicenseIndex = parseInt(sPath.split("/")[1], 10); // Índice de la fila seleccionada

            // Obtener el modelo y los datos actuales
            var oModel = this.getView().getModel("LicencesJsonModel");
            var aLicences = oModel.getProperty("/");

            // Obtener el nuevo horario del TimePicker
            var sNewTime = oEvent.getParameter("value");

            // Obtener los datos de la fila seleccionada
            var oSelectedLicence = aLicences[iLicenseIndex];

            // Actualizar solo las filas del mismo Grupo y Consola
            this._updateSameGroupAndConsoleShifts(aLicences, oSelectedLicence, sNewTime);

            // Reordenar las filas por Consola, luego por Grupo y finalmente por TurnoAsignado
            this._sortLicences(aLicences);

            // Actualizar el modelo con los cambios
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

            aLicences.sort((a, b) => {
                const aHasTurno = !!a.TurnoAsignado;
                const bHasTurno = !!b.TurnoAsignado;


                if (!aHasTurno && !bHasTurno) return 0;


                if (!aHasTurno) return 1;


                if (!bHasTurno) return -1;


                return this._convertShiftToMinutes(a.TurnoAsignado) -
                    this._convertShiftToMinutes(b.TurnoAsignado);
            });


            aLicences.sort((a, b) => {
                if (a.Consola !== b.Consola) {
                    return a.Consola.localeCompare(b.Consola);
                }
                return 0;
            });
        },

        _convertShiftToMinutes: function (shift) {
            const [hours, minutes] = shift.split(":").map(Number);
            return hours * 60 + minutes;
        },
        onDeletePress: function () {
            const oTable = this.getView().byId("turnosTable");
            const aSelectedIndices = oTable.getSelectedIndices(); // Índices seleccionados

            if (aSelectedIndices.length === 0) {
                MessageToast.show("Por favor, seleccione al menos una fila para eliminar.");
                return;
            }

            const oModel = this.getView().getModel("LicencesJsonModel");
            let aLicenses = oModel.getProperty("/");

            if (!Array.isArray(aLicenses) || aLicenses.length === 0) {
                MessageToast.show("No hay datos para eliminar.");
                return;
            }

            let aDataToDelete = [];

            // Ordenar índices de mayor a menor para evitar errores al eliminar
            aSelectedIndices.sort((a, b) => b - a);

            // Extraer datos de las filas seleccionadas
            aSelectedIndices.forEach(index => {
                if (index >= 0 && index < aLicenses.length) {
                    let oRowData = aLicenses[index];

                    aDataToDelete.push({
                        Id: oRowData.Id,
                        Empresa: oRowData.Empresa,
                        Tipo: oRowData.Tipo || "L",
                        Anio: oRowData.Anio,
                        Dateturno: new Date(oRowData.Fecha),
                    });

                    aLicenses.splice(index, 1); // Eliminar del modelo local
                }
            });

            // Actualizar modelo en la vista
            oModel.setProperty("/", aLicenses);
            oModel.refresh(true);
            oTable.clearSelection();

            MessageToast.show("Se ha eliminado la(s) licencia(s) seleccionada(s).");

            // Enviar al backend
            this.deleteTurno(aDataToDelete);
        },
        onDetachLicense: function () {
            var oTable = this.byId("turnosTable");

            // Check if a row is selected
            var iSelectedIndex = oTable.getSelectedIndex();
            if (iSelectedIndex === -1) {
                MessageToast.show("Por favor, seleccione una fila para desacoplar.");
                return;
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
            var shiftDuration = oDetachedLicense.Jobcond === "04" ? 30 : 15;

            currentTime += shiftDuration;
            oDetachedLicense.TurnoAsignado = this._formatTime(currentTime);

            // Assign a unique group for the detached license
            oDetachedLicense.Grupo = "_Desacoplado_" + oDetachedLicense.Id;

            // Insert the detached license after the last element of the group
            aLicences.splice(groupLastIndex + 1, 0, oDetachedLicense);

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

                    this.onCountItems(aNuevas);
                })
                .catch((error) => {
                    console.error("Error en la búsqueda:", error);
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
                id: oView.getId(),       // 👈 importante para heredar los ids
                name: fragment,
                controller: this,
            }).then(function (oFragment) {
                oDialog = oFragment;

                // Lo cuelgo de la vista
                oView.addDependent(oDialog);

                // 👇 Traigo el modelo de la vista y se lo paso al diálogo
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


            TurnosService.appendLicencesToModel(aNewData, this.getView());

            MessageBox.success("Se han agregado " + aNewData.length + " elementos correctamente.");

            console.log("Datos agregados:", aNewData);
        },

        onOpenComboPopover: function (oEvent) {

            this._oRowContext = oEvent.getSource().getBindingContext("LicencesJsonModel");


            var oModel = this.getView().getModel("LicencesJsonModel");
            var sPath = this._oRowContext.getPath();


            var aAccionesEntregas = oModel.getProperty(sPath + "/accionesEntregas") || [];


            if (!this._oComboPopover) {

                this._oComboPopover = sap.ui.xmlfragment("transener.sistemadeturnos.fragments.ComboPopover", this);
                this.getView().addDependent(this._oComboPopover);
            }


            this._initializeCheckBoxes(aAccionesEntregas);


            this._oComboPopover.openBy(oEvent.getSource());
        },
        _initializeCheckBoxes: function (aAccionesEntregas) {

            var oFragment = this._oComboPopover;


            var aCheckBoxes = [
                { id: "checkboxSOL_COC", key: "SOL COC" },
                { id: "checkboxSOL_TEC", key: "SOL TEC" },
                { id: "checkboxAUT_COC", key: "AUT COC" }

            ];

            aCheckBoxes.forEach(function (oCheckBox) {

                var oCheckBoxControl = sap.ui.core.Fragment.byId("transener.sistemadeturnos.fragments.ComboPopover", oCheckBox.id);


                if (oCheckBoxControl) {
                    oCheckBoxControl.setSelected(false);
                }
            });


            aAccionesEntregas.forEach(function (oEntry) {
                var oCheckBoxControl = aCheckBoxes.find(function (oCheckBox) {
                    return oCheckBox.key === oEntry.nombre;
                });

                if (oCheckBoxControl) {
                    var oCheckBoxUIControl = sap.ui.core.Fragment.byId("transener.sistemadeturnos.fragments.ComboPopover", oCheckBoxControl.id);
                    if (oCheckBoxUIControl) {
                        oCheckBoxUIControl.setSelected(true);
                    }
                }
            });
        }, onClosePopover: function () {
            this._oComboPopover.close();
        }, formatCheckBoxSelected: function (aAccionesEntregas, sCheckBoxKey) {

            return aAccionesEntregas && aAccionesEntregas.some(function (oEntry) {
                return oEntry.nombre === sCheckBoxKey;
            });
        }, onCheckBoxSelect: function (oEvent) {

            var oCheckBox = oEvent.getSource();
            var sKey = oCheckBox.getText();


            if (!this._oRowContext) {
                sap.m.MessageToast.show("No se pudo obtener el contexto de la fila.");
                return;
            }

            var oModel = this.getView().getModel("LicencesJsonModel");


            var sPath = this._oRowContext.getPath();


            var aAccionesEntregas = oModel.getProperty(sPath + "/accionesEntregas") || [];

            if (oCheckBox.getSelected()) {

                aAccionesEntregas.push({
                    nombre: sKey,
                    descripcion: "Descripción para " + sKey
                });
            } else {

                aAccionesEntregas = aAccionesEntregas.filter(function (oEntry) {
                    return oEntry.nombre !== sKey;
                });
            }

            // Actualizar el modelo con el nuevo array
            oModel.setProperty(sPath + "/accionesEntregas", aAccionesEntregas);
        }, onSaveTurnoPress: function () {

            //  const FechaTurno = ModelHelper.getModel("LicencesTurnoJsonModel",this.getView()).getProperty("/FechaTurno")
            const Fecha = this.getView().byId('date').getDateValue()
            const oTable = this.getView().byId('turnosTable');
            const aRows = oTable.getRows(); // Obtén las filas visibles de la tabla
            const aData = []; // Array para almacenar los datos de cada fila

            aRows.forEach(function (oRow) {
                // Accede al contexto de cada fila (a través del modelo asociado)
                const oContext = oRow.getBindingContext("LicencesJsonModel");
                if (oContext) {
                    // Obtén los datos de la fila a través del contexto
                    const oRowData = oContext.getObject();

                    const row = {
                        Id: oRowData.Id,
                        Empresa: oRowData.Empresa,
                        Tipo: oRowData.Tipo,
                        Anio: oRowData.Anio,
                        Fecha: Fecha,
                        Turno: oRowData.TurnoAsignado

                    }

                    aData.push(row);

                }
            });

            console.log("Datos de cada fila:", aData);

            this.createTurno(aData)
        },
        createTurno: function (licencias) {
            var entity = "/TurnosLicenciasSet";

            const oDataService = this.getView().getModel()

            licencias.forEach(function (licencia) {

                var license = {
                    "Id": licencia.Id,
                    "Empresa": licencia.Empresa,
                    "Tipo": licencia.Tipo || "L",
                    "Anio": licencia.Anio,
                    "Dateturno": new Date(licencia.Fecha),
                    "Turno": licencia.Turno
                };

                oDataService.create(entity, license);
            });
        },

        /**
         * Invoca el workflow para enviar correo electrónico
         * Este método se ejecuta cuando el usuario presiona el botón "Enviar Email"
         */
        onSendEmailPress: function () {
            const oView = this.getView();
            const oComponent = this.getOwnerComponent();

            // Obtener el email del destinatario
            // Puedes obtenerlo del usuario actual, de un campo en la vista, o de configuración
           // const sDestinatario = this._obtenerDestinatarioEmail();
            const sDestinatario = [
                "gq4dev@gmail.com",
                "daniela.bracamonte@altromondo.com.ar" // ← Cambia esto por el email real
            ];

            if (!sDestinatario) {
                MessageBox.warning(
                    "No se pudo determinar el destinatario del correo. Por favor, configure el email del destinatario.",
                    {
                        title: "Destinatario no configurado"
                    }
                );
                return;
            }

            // Mostrar indicador de carga
            this.showGlobalBusy("Iniciando workflow de envío de correo...");

            // Preparar el contexto del workflow
            const oContext = {
                Destinatario: sDestinatario
                // Puedes agregar más campos aquí según lo que necesite tu workflow
                // Ejemplo: FechaTurno, datos de las licencias, etc.
            };

            // Invocar el workflow
            WorkflowService.startWorkflowInstance({
                definitionId: "transener.wfturnos",
                context: oContext,
                oComponent: oComponent,
                onSuccess: (result) => {
                    this.hideGlobalBusy();
                    MessageBox.success(
                        "El workflow se ha iniciado correctamente. El correo será enviado pronto.",
                        {
                            title: "Workflow iniciado",
                            details: "ID de instancia: " + result.id
                        }
                    );
                    console.log("Workflow iniciado:", result);
                },
                onError: (error, jqXHR) => {
                    this.hideGlobalBusy();
                    let sErrorMessage = "Error al iniciar el workflow";

                    if (jqXHR && jqXHR.responseText) {
                        try {
                            const oErrorResponse = JSON.parse(jqXHR.responseText);
                            sErrorMessage = oErrorResponse.error?.message || sErrorMessage;
                        } catch (e) {
                            sErrorMessage = jqXHR.responseText;
                        }
                    } else if (error && error.message) {
                        sErrorMessage = error.message;
                    }

                    MessageBox.error(
                        sErrorMessage,
                        {
                            title: "Error al iniciar workflow"
                        }
                    );
                    console.error("Error al iniciar workflow:", error, jqXHR);
                }
            });
        },

        /**
         * Obtiene el email del destinatario
         * Puedes modificar este método para obtener el email de diferentes fuentes:
         * - Usuario actual del sistema
         * - Campo en la vista
         * - Configuración
         * - Modelo de datos
         * @returns {string} Email del destinatario
         */
        _obtenerDestinatarioEmail: function () {
            // Opción 1: Obtener del usuario actual (si está disponible)
            try {
                const oUserInfo = sap.ushell.Container.getService("UserInfo");
                if (oUserInfo && oUserInfo.getEmail) {
                    const sEmail = oUserInfo.getEmail();
                    if (sEmail) {
                        return sEmail;
                    }
                }
            } catch (e) {
                console.log("No se pudo obtener email del usuario actual:", e);
            }

            // Opción 2: Obtener de un campo en la vista (si tienes un Input para email)
            // const oEmailInput = this.byId("emailInput");
            // if (oEmailInput) {
            //     return oEmailInput.getValue();
            // }

            // Opción 3: Obtener de un modelo
            // const oModel = this.getView().getModel("configModel");
            // if (oModel) {
            //     return oModel.getProperty("/emailDestinatario");
            // }

            // Opción 4: Email por defecto (para pruebas)
            // TODO: Reemplazar con el email real o implementar una de las opciones anteriores
            return [
                "gq4dev@gmail.com",
                "daniela.bracamonte@altromondo.com.ar" // ← Cambia esto por el email real
            ];
            // Si no se encuentra ningún email, retornar null
            // return null;
        }
        , openAdvancedFilters: function () {
            var oFiltersModel = AppManagementHelper.getModel("FiltersJsonModel");
            var oHardCodeModel = AppManagementHelper.getModel("HardCodeModel");
            var PersonalHabilitadoModel = AppManagementHelper.getModel("PersonalHabilitadoModel");
            var oRepModel = AppManagementHelper.getModel("RepositionTimes");
            var oSelectModel = AppManagementHelper.getModel("SelectModel");
            var society = this.society;

            // Carga los servicios necesarios
            TipoEquipoService.loadTipoEquipo(society);
            InterventionTypesService.getPromise();

            // Verifica si ya existe el diálogo
            if (!this.advancedFilters) {
                // Carga el fragmento y lo inserta en el diálogo
                var oView = this.getView();
                Fragment.load({
                    id: oView.getId(),
                    name: "transener.sistemadeturnos.fragments.advancedFilters",
                    controller: this
                }).then(function (oDialogContent) {
                    var oDialog = new sap.m.Dialog({
                        title: "Filtros Avanzados",
                        contentWidth: "60%",
                        modal: true,
                        content: oDialogContent,
                        buttons: [
                            new sap.m.Button({
                                text: "Cancelar",
                                icon: "sap-icon://decline",
                                press: this.closeAdvancedFilters.bind(this)
                            }).addStyleClass("buttonInverted floatLeft"),
                            new sap.m.Button({
                                text: "Limpiar",
                                icon: "sap-icon://document",
                                press: this.clearAdvancedFilters.bind(this)
                            }).addStyleClass("buttonInverted floatLeft"),
                            new sap.m.Button({
                                text: "Aplicar",
                                icon: "sap-icon://search",
                                press: this.makeFilters.bind(this)
                            }).addStyleClass("buttonInverted floatRight")
                        ]
                    }).addStyleClass("customDialog");

                    // Asignar los modelos al diálogo
                    oDialog.setModel(AppManagementHelper.getModel("WorkPlacesJsonModel"), "WorkPlacesJsonModel");
                    oDialog.setModel(oView.getModel("GrupoPlanificador"), "GrupoPlanificador");
                    oDialog.setModel(AppManagementHelper.getModel("TiposIntervencion"), "TiposIntervencion");
                    oDialog.setModel(AppManagementHelper.getModel("TipoEquipoJsonModel"), "TipoEquipoJsonModel");
                    oDialog.setModel(oSelectModel, "SelectModel");
                    oDialog.setModel(oFiltersModel, "FiltersJsonModel");
                    oDialog.setModel(oHardCodeModel, "HardCodeModel");
                    oDialog.setModel(PersonalHabilitadoModel, "PersonalHabilitadoModel");
                    oDialog.setModel(oRepModel, "RepositionTimes");
                    oDialog.setModel(oView.getModel("RepositionTimes"), "RepositionTimes");
                    oDialog.setModel(AppManagementHelper.getModel("TipoLicFiltersModel"), "TipoLicFiltersModel");
                    oDialog.setModel(AppManagementHelper.getModel("CheckAdvancedFiltersModel"), "CheckAdvancedFiltersModel");

                    this.advancedFilters = oDialog;
                    this.advancedFilters.open();
                }.bind(this));
            } else {
                // Si ya existe el diálogo, actualiza los modelos y ábrelo
                this.advancedFilters.setModel(PersonalHabilitadoModel, "PersonalHabilitadoModel");
                this.advancedFilters.setModel(oSelectModel, "SelectModel");
                this.advancedFilters.setModel(oHardCodeModel, "HardCodeModel");
                this.advancedFilters.setModel(oFiltersModel, "FiltersJsonModel");
                this.advancedFilters.setModel(oRepModel, "RepositionTimes");
                this.advancedFilters.setModel(this.getView().getModel("RepositionTimes"), "RepositionTimes");
                this.advancedFilters.setModel(AppManagementHelper.getModel("WorkPlacesJsonModel"), "WorkPlacesJsonModel");
                this.advancedFilters.setModel(this.getView().getModel("GrupoPlanificador"), "GrupoPlanificador");
                this.advancedFilters.setModel(AppManagementHelper.getModel("TipoLicFiltersModel"), "TipoLicFiltersModel");
                this.advancedFilters.setModel(AppManagementHelper.getModel("CheckAdvancedFiltersModel"), "CheckAdvancedFiltersModel");
                this.advancedFilters.open();
            }
        },

        closeAdvancedFilters: function () {
            this.advancedFilters.close();
        },
    });
});
