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


], function (Controller, MessageToast, MessageBox, CoreLibrary, Filter, FilterOperator, JSONModel, Fragment, Spreadsheet,
    //utils
    ModelHelper, FormatHelper, Utils,
    //services
    LicenseService, TurnosService, TipoEquipoService, InterventionTypesService
) {
    "use strict";
    let oDialog = null
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
            const oView = this.getView();
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
                        .then(() => {
                        })
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

                            const licenciaCompleta = {
                                ...oData,
                                Timbeg: oData.Timbeg || null,
                                Timend: oData.Timend || null,
                                Gdate: oData.Gdate || null,
                                TurnoAsignado: turnoLicencia.Turno || ""
                            };

                            resolve(licenciaCompleta);
                        },
                        error: (oError) => {
                            LicenseService.FIND(turnoLicencia, oDataModel)
                                .then(result => {
                                    if (!result.Timbeg && turnoLicencia.Timbeg) {
                                        result.Timbeg = turnoLicencia.Timbeg;
                                    }
                                    resolve(result);
                                })
                                .catch(err => {
                                    console.error("Error en fallback FIND:", err);
                                    reject(err);
                                });
                        }
                    });
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

                    const turnosOriginales = {};
                    aResults.forEach(item => {
                        if (item.Id && item.Turno) {
                            turnosOriginales[item.Id] = item.Turno;
                        }
                    });

                    results.forEach(item => {

                        if (item.Timbeg && typeof item.Timbeg === 'string' && item.Timbeg !== "PT00H00M00S") {
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

                    const oDatePicker = this.byId("date");
                    const oFechaTurno = oDatePicker && oDatePicker.getDateValue();

                    const bIsEditable = this._isEditableTurno(oFechaTurno);

                    arrayOrdenado.forEach(item => {
                        item.isEditable = bIsEditable;

                        if (turnosOriginales[item.Id]) {
                            item.TurnoAsignado = turnosOriginales[item.Id];
                        }
                    });

                    oLicencesModel.setData(arrayOrdenado);
                    Utils.onCountItems(oView, arrayOrdenado);

                    // Clonamos la información
                    const arrayClonado = JSON.parse(JSON.stringify(arrayOrdenado));

                    arrayClonado.forEach(item => {
                        item.isEditable = bIsEditable;
                    });

                    // Ordenamos por turno
                    arrayClonado.sort(sortByTurnoAsignado);

                    // Modelo que usa la tabla cronológica
                    const oListCronoModel = new JSONModel(arrayClonado);
                    oView.setModel(oListCronoModel, "listCronoModel");

                    function sortByTurnoAsignado(a, b) {
                        const toMinutes = (hora) => {
                            if (!hora) return 0;
                            const [h, m] = hora.split(":").map(Number);
                            return h * 60 + m;
                        };

                        return toMinutes(a.TurnoAsignado) - toMinutes(b.TurnoAsignado);
                    }

                    this._loadAttachmentsForLicenses(arrayOrdenado);
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

                            oSelectedLicence.TurnoAsignado = "";
                            oModel.setProperty(sPath + "/TurnoAsignado", "");
                            oModel.refresh(true);
                        }
                    }
                );
                return;
            }

            oSource.setValueState(CoreLibrary.ValueState.None);
            oSource.setValueStateText("");

            // Solo actualizar licencia individual
            oSelectedLicence.TurnoAsignado = sNewTime;
            oModel.setProperty(sPath + "/TurnoAsignado", sNewTime);

            this._sortLicences(aLicences);

            const iNewIndex = aLicences.findIndex(function (lic) {
                return lic === oSelectedLicence;
            });

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

            const oDatePicker = this.byId("date");
            const oFechaTurno = oDatePicker && oDatePicker.getDateValue();
            const bIsEditable = this._isEditableTurno(oFechaTurno);

            aNewData.forEach(item => {
                item.isEditable = bIsEditable;
            });

            TurnosService.appendLicencesToModel(aNewData, this.getView());

            MessageBox.success("Se han agregado " + aNewData.length + " elementos correctamente.");
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
            const Fecha = this.getView().byId('date').getDateValue();

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

            const aData = [];
            const aAttachments = [];

            aAllLicences.forEach(function (oRowData) {
                const row = {
                    Id: oRowData.Id,
                    Empresa: oRowData.Empresa,
                    Tipo: oRowData.Tipo,
                    Anio: oRowData.Anio,
                    Fecha: Fecha,
                    Turno: oRowData.TurnoAsignado,
                    Comentarios: oRowData.Comentarios
                };

                if (oRowData.AttachmentData) {
                    aAttachments.push({
                        Id: oRowData.Id,
                        Empresa: oRowData.Empresa,
                        Anio: oRowData.Anio,
                        AttachmentData: oRowData.AttachmentData,
                        AttachmentName: oRowData.AttachmentName,
                        AttachmentType: oRowData.AttachmentType
                    });
                }

                aData.push(row);
            });

            this.createTurno(aData, aAttachments);
        },

        createTurno: function (licencias, aAttachments) {
            const entity = "/TurnosLicenciasSet";
            const oDataService = this.getView().getModel();
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            this.showGlobalBusy("Guardando turnos...");

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
                            reject(oError);
                        }
                    });
                });
            });

            Promise.all(aPromises)
                .then(() => {

                    MessageToast.show(oResourceBundle.getText("saveTurno") + " - Éxito");

                    if (aAttachments && aAttachments.length > 0) {
                        this._saveAttachments(aAttachments)
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
                    console.error(error);
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
                    this.successSelectTurno(oData)
                        .then(() => {
                        })
                        .catch((err) => {
                            console.error("Error al procesar datos recargados:", err);
                        })
                        .finally(() => {
                            this.hideGlobalBusy();
                        });
                },
                error: (oError) => {
                    this.hideGlobalBusy();
                }
            });
        },

        createTurno: function (licencias, aAttachments) {
            const entity = "/TurnosLicenciasSet";
            const oDataService = this.getView().getModel();
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            this.showGlobalBusy("Guardando turnos...");

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

        // ==================== MÉTODOS PARA ADJUNTAR ARCHIVOS PDF ====================
        onAttachFile: function (oEvent) {
            this._currentAttachmentContext = oEvent.getSource().getBindingContext("LicencesJsonModel");

            if (!this._fileInput) {
                this._fileInput = document.createElement("input");
                this._fileInput.type = "file";
                this._fileInput.accept = "application/pdf";
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

            if (file.type !== "application/pdf") {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("invalidFileType"));
                return;
            }

            const maxSize = 5 * 1024 * 1024;
            if (file.size > maxSize) {
                MessageBox.error(this.getView().getModel("i18n").getResourceBundle().getText("fileTooLarge"));
                return;
            }

            this._convertFileToBase64(file);
        },

        _convertFileToBase64: function (file) {
            const reader = new FileReader();

            reader.onload = function (e) {
                const base64String = e.target.result;

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
                const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
                MessageToast.show(oResourceBundle.getText("noAttachmentToView"));
                return;
            }

            this._currentPDFData = {
                data: oData.AttachmentData,
                name: oData.AttachmentName || "archivo.pdf"
            };

            this._openPDFViewer(oData.AttachmentData);
        },

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

        onDeleteAttachment: function (oEvent) {
            const oContext = oEvent.getSource().getBindingContext("LicencesJsonModel");

            if (!oContext) {
                return;
            }

            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            const oData = oContext.getObject();

            MessageBox.confirm(oResourceBundle.getText("confirmDeleteAttachment"), {
                title: oResourceBundle.getText("confirmDeleteTitle"),
                onClose: function (sAction) {
                    if (sAction === MessageBox.Action.OK) {
                        if (oData.Attindex) {
                            this._deleteAttachmentFromBackend(oData);
                        } else {
                            const oModel = this.getView().getModel("LicencesJsonModel");
                            const sPath = oContext.getPath();

                            oModel.setProperty(sPath + "/AttachmentData", null);
                            oModel.setProperty(sPath + "/AttachmentName", null);
                            oModel.setProperty(sPath + "/AttachmentSize", null);
                            oModel.setProperty(sPath + "/AttachmentType", null);
                            oModel.setProperty(sPath + "/Attindex", null);

                            oModel.refresh(true);

                            MessageToast.show(oResourceBundle.getText("fileDeletedSuccess"));
                        }
                    }
                }.bind(this)
            });
        },

        // ==================== MÉTODOS PARA BACKEND DE ADJUNTOS ====================

        _loadAttachmentsForLicenses: function (aLicencias) {
            if (!aLicencias || aLicencias.length === 0) {
                return;
            }

            const oDataModel = this.getView().getModel();
            const oLicencesModel = this.getView().getModel("LicencesJsonModel");

            aLicencias.forEach((licencia, index) => {
                const aFilters = [
                    new Filter("Id", FilterOperator.EQ, licencia.Id),
                    new Filter("Empresa", FilterOperator.EQ, licencia.Empresa),
                    new Filter("Anio", FilterOperator.EQ, licencia.Anio)
                ];

                oDataModel.read("/AttachmentLicenciasSet", {
                    filters: aFilters,
                    success: (oData) => {
                        if (oData.results && oData.results.length > 0) {
                            const oAttachment = oData.results[0];

                            const sDataUrl = "data:" + oAttachment.Doctype + ";base64," + oAttachment.Attachment;

                            oLicencesModel.setProperty("/" + index + "/AttachmentData", sDataUrl);
                            oLicencesModel.setProperty("/" + index + "/AttachmentName", oAttachment.Filename);
                            oLicencesModel.setProperty("/" + index + "/AttachmentType", oAttachment.Doctype);
                            oLicencesModel.setProperty("/" + index + "/Attindex", oAttachment.Attindex);
                        }
                    },
                    error: (oError) => {
                        console.error("Error al cargar adjuntos para licencia:", licencia.Id, oError);
                    }
                });
            });
        },

        _saveAttachments: function (aAttachments) {
            const oDataService = this.getView().getModel();
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            const aPromises = aAttachments.map((attachment) => {
                return new Promise((resolve, reject) => {
                    let base64Data = attachment.AttachmentData;
                    if (base64Data.includes(",")) {
                        base64Data = base64Data.split(",")[1];
                    }

                    const oAttachment = {
                        "Id": attachment.Id,
                        "Empresa": attachment.Empresa,
                        "Anio": attachment.Anio,
                        "Attindex": "1",
                        "Attachment": base64Data,
                        "Filename": attachment.AttachmentName,
                        "Doctype": attachment.AttachmentType || "application/pdf"
                    };

                    oDataService.create("/AttachmentLicenciasSet", oAttachment, {
                        success: () => {
                            resolve();
                        },
                        error: (oError) => {
                            console.error("Error al guardar adjunto:", oError);
                            reject(oError);
                        }
                    });
                });
            });

            Promise.all(aPromises)
                .then(() => {
                    this.hideGlobalBusy();
                    MessageToast.show("Adjuntos guardados exitosamente");
                })
                .catch((error) => {
                    this.hideGlobalBusy();
                    MessageBox.warning("Los turnos se guardaron pero hubo errores al guardar algunos adjuntos");
                    console.error(error);
                });
        },

        _deleteAttachmentFromBackend: function (oLicenseData) {
            const oDataModel = this.getView().getModel();
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            this.showGlobalBusy("Eliminando adjunto...");

            const sPath = oDataModel.createKey("/AttachmentLicenciasSet", {
                Id: oLicenseData.Id,
                Empresa: oLicenseData.Empresa,
                Anio: oLicenseData.Anio,
                Attindex: oLicenseData.Attindex
            });

            oDataModel.remove(sPath, {
                success: () => {
                    this.hideGlobalBusy();

                    const oLicencesModel = this.getView().getModel("LicencesJsonModel");
                    const aLicencias = oLicencesModel.getData();
                    const iIndex = aLicencias.findIndex(lic =>
                        lic.Id === oLicenseData.Id &&
                        lic.Empresa === oLicenseData.Empresa &&
                        lic.Anio === oLicenseData.Anio
                    );

                    if (iIndex !== -1) {
                        oLicencesModel.setProperty("/" + iIndex + "/AttachmentData", null);
                        oLicencesModel.setProperty("/" + iIndex + "/AttachmentName", null);
                        oLicencesModel.setProperty("/" + iIndex + "/AttachmentSize", null);
                        oLicencesModel.setProperty("/" + iIndex + "/AttachmentType", null);
                        oLicencesModel.setProperty("/" + iIndex + "/Attindex", null);
                    }

                    MessageToast.show(oResourceBundle.getText("fileDeletedSuccess"));
                },
                error: (oError) => {
                    this.hideGlobalBusy();
                    MessageBox.error("Error al eliminar el adjunto del backend");
                    console.error(oError);
                }
            });
        },

        //----------------------------------------------------------------------------------

        onLicenseSearch: function (oEvent) {
            const sQuery = oEvent.getParameter("newValue")?.trim() || "";
            const oTable = this.byId("idLicensesTable");
            const oBinding = oTable.getBinding("items");

            if (!sQuery) {
                oBinding.filter([]);  // Quita filtros
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
                    console.error("Error al procesar datos del reporte:", err);
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
                        console.error("Error en FIND para licencia", licencia, err);
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
                    console.error("Error inesperado en Promise.all:", error);
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
                console.error("Error al generar el Excel:", error);
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

            // Si existe make_xlsx_lib, inicializarlo (como en el código que funciona)
            if (typeof make_xlsx_lib === 'function') {
                make_xlsx_lib(XLSX);
            }

            try {
                // Crear workbook
                var Workbook = XLSX.utils.book_new();

                // SOLAPA 1: Resumen por Fecha
                var aDatosResumen = this.prepareResumenPorFecha(aData, oDateInicio, oDateFin);
                var sheet1 = XLSX.utils.aoa_to_sheet(aDatosResumen);

                // Calcular dónde empezar las nuevas grillas (después del resumen + 3 filas vacías)
                var iFilaInicioGrillas = aDatosResumen.length + 3;

                // Función helper para convertir número de columna a letra de Excel (0=A, 1=B, etc.)
                var getColumnLetter = function (colNum) {
                    var result = "";
                    while (colNum >= 0) {
                        result = String.fromCharCode(65 + (colNum % 26)) + result;
                        colNum = Math.floor(colNum / 26) - 1;
                    }
                    return result;
                };

                // Variable para rastrear en qué columna empezar la siguiente grilla
                var iColumnaActual = 0; // Empieza en columna A (0)
                var oFormatter = this.formatter;

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

                // Para cada fecha, crear una grilla
                aFechas.forEach(function (oFecha) {
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
                    var oMapaDuplicados = {}; // Clave: "Equnr|TurnoAsignado"

                    aLicenciasFecha.forEach(function (license) {
                        var sEquipo = license.Equnr || "";
                        var sTurno = license.TurnoAsignado || "";
                        var sClave = sEquipo + "|" + sTurno;

                        // Si no existe esta combinación, agregarla
                        if (!oMapaDuplicados[sClave]) {
                            oMapaDuplicados[sClave] = true;
                            aLicenciasUnicas.push(license);
                        }
                    });

                    // Crear la grilla para esta fecha
                    var aGrillaFecha = [];
                    // Título de la grilla
                    var sFechaFormateada = oFormatter.formatDate(oFecha);
                    aGrillaFecha.push(["Horarios de maniobras previstos " + sFechaFormateada]);
                    // Encabezados
                    aGrillaFecha.push(["Equipo", "Hora", "Comentarios"]);
                    // Datos
                    aLicenciasUnicas.forEach(function (license) {
                        var sEquipo = license.Equnr || "";
                        var sHora = license.TurnoAsignado || (license.Horainicio ? oFormatter.durationToTime(license.Horainicio)
                            : (license.Gdate ? oFormatter.msTohoursSeconds(license.Gdate) : ""));
                        var sComentarios = license.Comments || license.PatAdic || "";
                        aGrillaFecha.push([sEquipo, sHora, sComentarios]);
                    });

                    // Agregar la grilla al sheet
                    var sColumnaInicio = getColumnLetter(iColumnaActual);
                    var iFilaInicio = iFilaInicioGrillas + 1;
                    XLSX.utils.sheet_add_aoa(sheet1, aGrillaFecha, {
                        origin: sColumnaInicio + iFilaInicio.toString()
                    });

                    // Avanzar: ancho de grilla (3 columnas) + 2 columnas de separación
                    iColumnaActual += 3 + 2;
                });

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
                console.error("Error al generar el Excel de maniobras:", error);
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
                console.log("📊 prepareLicenciasData - License:", license.Id);
                console.log("   Horainicio:", license.Horainicio, "Tipo:", typeof license.Horainicio);
                console.log("   Gdate:", license.Gdate, "Tipo:", typeof license.Gdate);

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
                    "Comentario": license.Comentarios || ""
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

        //Filtra la tabla por ID de licencia usando el input de búsqueda rápida
        // ==================== MÉTODOS DE FILTRADO Y BÚSQUEDA ====================

        /**
         * Filtra la tabla por ID de licencia usando el input de búsqueda rápida
         */
        onFilter: function () {
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            const oInput = this.byId("fastSearchInput");
            const sQuery = oInput.getValue().trim();

            if (!sQuery) {
                MessageToast.show(oResourceBundle.getText("noSearchCriteria"));
                return;
            }

            const oTable = this.byId("turnosTable");
            const oBinding = oTable.getBinding("rows");

            if (!oBinding) {
                return;
            }

            // Crear filtro para buscar por ID de licencia
            const aFilters = [
                new Filter("Id", FilterOperator.Contains, sQuery)
            ];

            oBinding.filter(aFilters);

            // Verificar si hay resultados
            setTimeout(function () {
                const iRowCount = oBinding.getLength();
                if (iRowCount === 0) {
                    MessageToast.show(oResourceBundle.getText("noResults"));
                } else {
                    MessageToast.show(oResourceBundle.getText("filterApplied"));
                }
            }.bind(this), 100);
        },

        /**
         * Limpia todos los filtros aplicados a la tabla
         */
        onClearFilter: function () {
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();

            // Limpiar el input de búsqueda
            const oInput = this.byId("fastSearchInput");
            if (oInput) {
                oInput.setValue("");
            }

            // Limpiar filtros de la tabla
            const oTable = this.byId("turnosTable");
            const oBinding = oTable.getBinding("rows");

            if (oBinding) {
                oBinding.filter([]);
            }

            MessageToast.show(oResourceBundle.getText("filtersCleared"));
        },

        /**
         * Refresca los datos de la tabla cargando nuevamente el turno actual
         */
        onRefresh: function () {
            const oResourceBundle = this.getView().getModel("i18n").getResourceBundle();
            const oDatePicker = this.byId("date");
            const oDateValue = oDatePicker && oDatePicker.getDateValue();

            if (!oDateValue) {
                MessageBox.warning(oResourceBundle.getText("noSearchCriteria"));
                return;
            }

            // Limpiar filtros antes de refrescar
            this.onClearFilter();

            // Recargar datos
            this.showGlobalBusy(oResourceBundle.getText("updatingData"));

            const oView = this.getView();
            const oDataService = this.getView().getModel();

            const aFilters = [];
            aFilters.push(new Filter("Dateturno", FilterOperator.EQ, oDateValue));
            aFilters.push(new Filter("Empresa", FilterOperator.EQ, "100"));

            const sEntity = "/TurnosLicenciasSet";

            oDataService.read(sEntity, {
                filters: aFilters,
                success: (oData) => {
                    this.successSelectTurno(oData)
                        .then(() => {
                            MessageToast.show(oResourceBundle.getText("dataRefreshed"));
                        })
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
                    Utils.onCountItems(oView, []);
                    this.hideGlobalBusy();
                    MessageBox.error(oResourceBundle.getText("errorUpdatingData"));
                }
            });
        },

        //Editar turnos

        _isEditableTurno: function (fechaTurno) {
            if (!fechaTurno) {
                return false;
            }

            // Normalizar fecha del turno a UTC 00:00:00
            const oFechaTurno = new Date(fechaTurno);
            const oFechaTurnoNormalizada = new Date(Date.UTC(
                oFechaTurno.getUTCFullYear(),
                oFechaTurno.getUTCMonth(),
                oFechaTurno.getUTCDate(),
                0, 0, 0, 0
            ));

            // Normalizar fecha actual a UTC 00:00:00
            const oHoy = new Date();
            const oHoyNormalizada = new Date(Date.UTC(
                oHoy.getFullYear(),
                oHoy.getMonth(),
                oHoy.getDate(),
                0, 0, 0, 0
            ));

            // Retornar true si la fecha del turno es >= hoy
            return oFechaTurnoNormalizada.getTime() >= oHoyNormalizada.getTime();
        },

        // Restriccón horaria

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

    });
});
