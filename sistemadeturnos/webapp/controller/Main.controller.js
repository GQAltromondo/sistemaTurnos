sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/core/library",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
    "sap/ui/core/Fragment",
    "transener/sistemadeturnos/utils/ModelHelper",
    "transener/sistemadeturnos/utils/FormatHelper",
    "transener/sistemadeturnos/utils/Utils",
    "transener/sistemadeturnos/services/LicenseService",
    "transener/sistemadeturnos/services/TurnosService",
    "transener/sistemadeturnos/services/TipoEquipoService",
    "transener/sistemadeturnos/services/InterventionTypesService",


], function (Controller, MessageToast, MessageBox, CoreLibrary, Filter, FilterOperator, Fragment,
    //utils
    ModelHelper, FormatHelper, Utils,
    //services
    LicenseService, TurnosService, TipoEquipoService, InterventionTypesService
) {
    "use strict";
    var oDialog = null
    return Controller.extend("transener.sistemadeturnos.controller.Main", {
        formatter: FormatHelper,

        onInit: function () {

            this._pBusyDialog = null;
            this.getVersion();
            this.getBaseURL();

            this.cargarModelos()
        },
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
        onTabSelect: function (oEvent) {
            const key = oEvent.getParameter("key");
            this.getView().getModel("tabsControl").setProperty("/activeTab", key);
        },
        onSelectTurno: function (oEvent) {

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
                    Utils.onCountItems([]);
                    this.hideGlobalBusy();
                }
            });
        },
        onSearch: function () {
            this._openFechaTurnoPopup();
        },

        _checkExistingTurnoAndProceed: function (oDateValue) {
            const oView = this.getView();
            const oDataService = oView.getModel();

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

                    // ✅ existe -> preguntar editar
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

                                    this.successSelectTurno(oData)
                                        .catch((err) => console.error("Error en successSelectTurno:", err))
                                        .finally(() => this.hideGlobalBusy());
                                }
                            }
                        });

                        return;
                    }


                    this.hideGlobalBusy();
                    this._resetDefaultTurnoModel();
                    this._doSearchTurnos(oDateValue);
                },
                error: (oError) => {
                    console.error(oError);

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
                    text: "Buscar",
                    type: "Emphasized",
                    press: function () {
                        var oDateValue = that._oFechaTurnoPicker.getDateValue();
                        if (!oDateValue) {
                            sap.m.MessageToast.show("Seleccione una fecha");
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

            TurnosService.search({ FechaTurno, oView: this.getView(), isRefresh: false })
                .then((data) => {
                    oLicencesModel.setData(data);
                    oLicencesModel.refresh();
                    oTable.setBusy(false);
                    Utils.onCountItems(this.getView(), data);
                })
                .catch((error) => {
                    console.error("Error en la búsqueda:", error);
                    oLicencesModel.setData([]);
                    oLicencesModel.refresh();
                    oTable.setBusy(false);
                });
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

            const aPromises = aResults.map((licencia) => {
                return LicenseService.FIND(licencia, oDataModel)
                    .then(result => result)
                    .catch(err => {
                        console.error("Error en FIND para licencia", licencia, err);
                        return null;
                    });
            });


            return Promise.all(aPromises)
                .then((licenciasProcesadas) => {
                    const results = licenciasProcesadas.filter(x => x);

                    if (!results.length) {
                        oLicencesModel.setData([]);
                        Utils.onCountItems(oView, []);
                        return;
                    }

                    const arrayOrdenado = TurnosService.encontrarGrupo(
                        TurnosService.ordenarPorEqunr(results),
                        oView
                    );

                    TurnosService.assignShiftsToLicences(arrayOrdenado);

                    oLicencesModel.setData(arrayOrdenado);
                    Utils.onCountItems(oView, arrayOrdenado);
                })
                .catch((error) => {
                    console.error("Error inesperado en Promise.all:", error);
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

            var oSource = oEvent.getSource(); // TimePicker
            var sPath = oSource.getBindingContext("LicencesJsonModel").getPath();
            var iLicenseIndex = parseInt(sPath.split("/")[1], 10);

            var oModel = this.getView().getModel("LicencesJsonModel");
            var aLicences = oModel.getProperty("/");

            var sNewTime = oEvent.getParameter("value");
            var oSelectedLicence = aLicences[iLicenseIndex];

            this._updateSameGroupAndConsoleShifts(aLicences, oSelectedLicence, sNewTime);

            this._sortLicences(aLicences);

            // buscar nuevo índice después del sort
            var iNewIndex = aLicences.findIndex(function (lic) {
                return lic === oSelectedLicence;
            });

            // 👉 ahora le pasamos el timepicker también
            this._cascadeGroupsDown(aLicences, iNewIndex, oSource);

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
        onDeletePress: function () {
            const oTable = this.getView().byId("turnosTable");
            const aSelectedIndices = oTable.getSelectedIndices();

            // 🔹 Validar selección
            if (!aSelectedIndices || aSelectedIndices.length === 0) {
                MessageToast.show("Por favor, seleccione al menos una fila para eliminar.");
                return;
            }

            // 🔹 Tomar fecha del turno (para la key Dateturno)
            const oDatePicker = this.byId("date");
            const oFechaTurno = oDatePicker && oDatePicker.getDateValue();

            if (!oFechaTurno) {
                MessageBox.warning("Debe seleccionar una fecha de turno para poder eliminar.");
                return;
            }

            // 🔹 Obtener modelo local
            const oJsonModel = this.getView().getModel("LicencesJsonModel");
            let aLicenses = oJsonModel.getProperty("/") || [];

            if (!Array.isArray(aLicenses) || aLicenses.length === 0) {
                MessageToast.show("No hay datos para eliminar.");
                return;
            }

            // 🔹 Ordenar índices de mayor a menor para eliminar sin problemas
            const aSortedIndices = aSelectedIndices.slice().sort(function (a, b) {
                return b - a;
            });

            const aDataToDelete = [];

            // 🔹 Armar payload para backend y eliminar del modelo local
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

            // 🔹 Borrado en backend
            const oDataModel = this.getView().getModel(); // ODataModel v2

            const aPromises = aDataToDelete.map(function (oItem) {
                return new Promise(function (resolve, reject) {
                    // Armar path de la entidad con la key
                    const sPath = oDataModel.createKey("/TurnosLicenciasSet", {
                        Id: oItem.Id,
                        Empresa: oItem.Empresa,
                        Tipo: oItem.Tipo,
                        Anio: oItem.Anio,
                        Dateturno: oItem.Dateturno
                    });

                    oDataModel.remove(sPath, {
                        success: function () {
                            resolve();
                        },
                        error: function (oError) {
                            reject(oError);
                        }
                    });
                });
            });

            Promise.all(aPromises)
                .then(function () {
                    const iCount = aDataToDelete.length;
                    const sMsg = iCount === 1
                        ? "La licencia seleccionada ha sido eliminada."
                        : "Se han eliminado " + iCount + " licencias.";
                    MessageToast.show(sMsg);
                })
                .catch(function (oError) {
                    MessageBox.error("Ocurrió un error al eliminar en backend.");
                    // console.error(oError); // si querés loguear
                });
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
            const shiftInfo = Utils.getShiftInfo(oDetachedLicense);
            const shiftDuration = shiftInfo.duration;

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
        },
        onSaveTurnoPress: function () {
            const Fecha = this.getView().byId('date').getDateValue()
            const oTable = this.getView().byId('turnosTable');
            const aRows = oTable.getRows();
            const aData = [];
            let hasAttachments = false; // ✨ NUEVO

            aRows.forEach(function (oRow) {
                const oContext = oRow.getBindingContext("LicencesJsonModel");
                if (oContext) {
                    const oRowData = oContext.getObject();

                    const row = {
                        Id: oRowData.Id,
                        Empresa: oRowData.Empresa,
                        Tipo: oRowData.Tipo,
                        Anio: oRowData.Anio,
                        Fecha: Fecha,
                        Turno: oRowData.TurnoAsignado,
                        Comentarios: oRowData.Comentarios
                    }

                    // ✨ NUEVO: Incluir datos de adjunto si existen
                    if (oRowData.AttachmentData) {
                        hasAttachments = true;
                        row.AttachmentData = oRowData.AttachmentData;
                        row.AttachmentName = oRowData.AttachmentName;
                        row.AttachmentSize = oRowData.AttachmentSize;
                        row.AttachmentType = oRowData.AttachmentType;
                    }

                    aData.push(row);
                }
            });

            console.log("Datos de cada fila:", aData);

            // ✨ NUEVO: Mostrar advertencia si hay archivos adjuntos
            if (hasAttachments) {
                MessageBox.information(
                    this.getView().getModel("i18n").getResourceBundle().getText("backendNotIntegrated") +
                    "\n\nLos archivos adjuntos están listos en el modelo pero no se enviarán al backend hasta que se complete la integración.",
                    {
                        title: "Información",
                        onClose: function () {
                            this.createTurno(aData);
                        }.bind(this)
                    }
                );
            } else {
                this.createTurno(aData);
            }
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
                    "Turno": licencia.Turno,
                    "Comentarios": licencia.Comentarios
                };

                oDataService.create(entity, license);
            });
        },
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
            this.advancedFilters.close();
        },
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

        onAttachFile: function (oEvent) {
            // Guardar el contexto de la fila
            this._currentAttachmentContext = oEvent.getSource().getBindingContext("LicencesJsonModel");

            // Crear un input file oculto para seleccionar el archivo
            if (!this._fileInput) {
                this._fileInput = document.createElement("input");
                this._fileInput.type = "file";
                this._fileInput.accept = "application/pdf";
                this._fileInput.style.display = "none";

                // Evento cuando se selecciona un archivo
                this._fileInput.addEventListener("change", function (e) {
                    this._handleFileSelection(e);
                }.bind(this));

                document.body.appendChild(this._fileInput);
            }

            // Resetear el input y abrirlo
            this._fileInput.value = null;
            this._fileInput.click();
        },

        _handleFileSelection: function (oEvent) {
            const file = oEvent.target.files[0];

            if (!file) {
                return;
            }

            // Validar que sea PDF
            if (file.type !== "application/pdf") {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("invalidFileType"));
                return;
            }

            // Validar tamaño (máximo 5MB)
            const maxSize = 5 * 1024 * 1024; // 5MB en bytes
            if (file.size > maxSize) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("fileTooLarge"));
                return;
            }

            // Convertir a Base64
            this._convertFileToBase64(file);
        },

        _convertFileToBase64: function (file) {
            const reader = new FileReader();

            reader.onload = function (e) {
                const base64String = e.target.result;

                // Guardar en el modelo
                if (this._currentAttachmentContext) {
                    const oModel = this.getView().getModel("LicencesJsonModel");
                    const sPath = this._currentAttachmentContext.getPath();

                    oModel.setProperty(sPath + "/AttachmentData", base64String);
                    oModel.setProperty(sPath + "/AttachmentName", file.name);
                    oModel.setProperty(sPath + "/AttachmentSize", file.size);
                    oModel.setProperty(sPath + "/AttachmentType", file.type);

                    oModel.refresh(true);

                    MessageToast.show(this.getView().getModel("i18n").getResourceBundle().getText("fileUploadSuccess"));
                }
            }.bind(this);

            reader.onerror = function () {
                MessageBox.error("Error al leer el archivo. Por favor, intente nuevamente.");
            };

            reader.readAsDataURL(file);
        },

        onDownloadFile: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("LicencesJsonModel");

            if (!oContext) {
                return;
            }

            const oData = oContext.getObject();

            if (!oData.AttachmentData) {
                MessageToast.show("No hay archivo adjunto para descargar.");
                return;
            }

            // Crear un enlace temporal para descargar
            const link = document.createElement("a");
            link.href = oData.AttachmentData;
            link.download = oData.AttachmentName || "archivo.pdf";

            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            MessageToast.show("Descargando archivo: " + link.download);
        },

        onDeleteAttachment: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("LicencesJsonModel");

            if (!oContext) {
                return;
            }

            MessageBox.confirm("¿Está seguro que desea eliminar el archivo adjunto?", {
                title: "Confirmar eliminación",
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        const oModel = this.getView().getModel("LicencesJsonModel");
                        const sPath = oContext.getPath();

                        // Eliminar las propiedades del adjunto
                        oModel.setProperty(sPath + "/AttachmentData", null);
                        oModel.setProperty(sPath + "/AttachmentName", null);
                        oModel.setProperty(sPath + "/AttachmentSize", null);
                        oModel.setProperty(sPath + "/AttachmentType", null);

                        oModel.refresh(true);

                        MessageToast.show("Archivo eliminado correctamente.");
                    }
                }.bind(this)
            });
        },
    });
});
