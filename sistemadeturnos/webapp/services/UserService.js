sap.ui.define([
    "sap/ui/model/json/JSONModel"
], function (JSONModel) {
    "use strict";

    return {
        loadModel: function (callback) {
            this.callback = callback;

            var mock = {
                firstname: "Usuario",
                lastname: "Prueba",
                email: "usuario.prueba@transener.com.ar",
                name: "usuario.prueba",
                displayName: "Usuario Prueba",
                login_name: "usuario.prueba",
                groups: [
                    "ope_programacion_cotdt",
                    "ope_programacion_cot",
                    "ope_jefe_cot"
                ]
            };

            var that = this;

            // Obtener URL base correctamente
            var appInfo = sap.ui.getCore().getModel("appCurrentInfo");
            
            if (!appInfo) {
                that._setUserModel(mock);
                if (that.callback) {
                    that.callback();
                }
                return;
            }

            var baseUrl = appInfo.getProperty("/appUrl");
            
            if (!baseUrl) {
                that._setUserModel(mock);
                if (that.callback) {
                    that.callback();
                }
                return;
            }

            var url = baseUrl + "/user-api/currentUser";
            console.log("URL construida:", url);

            var oModel = new JSONModel();
            oModel.loadData(url);

            oModel.dataLoaded()
                .then(function () {
                    var userData = oModel.getData();
                    console.log("Datos de usuario recibidos:", userData);

                    if (userData && userData.name) {
                        var iasUrl = baseUrl + '/IAS/service/scim/Users?filter=userName eq "' + userData.name + '"';

                        jQuery.ajax({
                            type: "GET",
                            contentType: "application/scim+json",
                            url: iasUrl,
                            xhrFields: { withCredentials: false },
                            dataType: "json",
                            async: true,
                            success: function (data) {
                                console.log("Respuesta IAS:", data);
                                
                                if (data.Resources && data.Resources.length > 0) {
                                    var aDatosUsuario = that._armarDatos(data.Resources);
                                    that._setUserModel(aDatosUsuario);

                                    if (that.callback) {
                                        that.callback();
                                    }
                                } else {
                                    // Usar datos reales del usuario pero roles por defecto
                                    var userWithDefaultRoles = {
                                        firstName: userData.firstname || "",
                                        lastName: userData.lastname || "",
                                        email: userData.email || "",
                                        name: userData.name || "",
                                        displayName: userData.displayName || "",
                                        login_name: userData.name || "",
                                        groups: [
                                            "ope_programacion_cotdt",
                                            "ope_programacion_cot",
                                            "ope_jefe_cot"
                                        ]
                                    };
                                    that._setUserModel(userWithDefaultRoles);
                                    if (that.callback) {
                                        that.callback();
                                    }
                                }
                            },
                            error: function (xhr, textStatus, error) {
                                // Usar datos reales del usuario pero roles por defecto
                                var userWithDefaultRoles = {
                                    firstName: userData.firstname || "",
                                    lastName: userData.lastname || "",
                                    email: userData.email || "",
                                    name: userData.name || "",
                                    displayName: userData.displayName || "",
                                    login_name: userData.name || "",
                                    groups: [
                                        "ope_programacion_cotdt",
                                        "ope_programacion_cot",
                                        "ope_jefe_cot"
                                    ]
                                };
                                that._setUserModel(userWithDefaultRoles);
                                if (that.callback) {
                                    that.callback();
                                }
                            }
                        });
                    } else {
                        console.log("No se obtuvieron datos de usuario, usando mock");
                        that._setUserModel(mock);
                        if (that.callback) {
                            that.callback();
                        }
                    }
                })
                .catch(function (error) {
                    console.error("Error al cargar usuario:", error);
                    that._setUserModel(mock);
                    if (that.callback) {
                        that.callback();
                    }
                });
        },

        _armarDatos: function (datos) {
            var aGroupsTemporal = datos[0].corporateGroups || datos[0].groups || [];

            var aGroups = aGroupsTemporal.map(function (fila) {
                return fila.value;
            });

            return {
                firstName: datos[0].name ? datos[0].name.givenName : "",
                lastName: datos[0].name ? datos[0].name.familyName : "",
                email: datos[0].emails && datos[0].emails[0] ? datos[0].emails[0].value : "",
                name: datos[0].emails && datos[0].emails[0] ? datos[0].emails[0].value : "",
                displayName: datos[0].displayName || "",
                login_name: datos[0].userName || "",
                groups: aGroups
            };
        },

        _getRoles: function (groupData) {
            var aData = [];
            if (Array.isArray(groupData)) {
                aData = aData.concat(groupData);
            } else if (groupData && groupData !== "") {
                aData.push(groupData);
            }
            return aData;
        },

        _setUserModel: function (data) {
            var oUserModel = sap.ui.getCore().getModel("UserJsonModel");

            if (!oUserModel) {
                oUserModel = new JSONModel();
                sap.ui.getCore().setModel(oUserModel, "UserJsonModel");
            }

            oUserModel.setData({
                nombre: data.firstName || data.firstname || "",
                apellido: data.lastName || data.lastname || "",
                login_name: data.login_name || data.name || "",
                email: data.email || "",
                displayName: data.displayName || "",
                roles: this._getRoles(data.groups)
            });

            console.log("Usuario cargado con roles:", oUserModel.getData());
        }
    };
});