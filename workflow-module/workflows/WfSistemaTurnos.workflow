{
	"contents": {
		"7435bb8d-3d60-47c8-83a4-1c55d8783e80": {
			"classDefinition": "com.sap.bpm.wfs.Model",
			"id": "wfturnos",
			"subject": "WFTurnos",
			"name": "WFTurnos",
			"documentation": "",
			"lastIds": "62d7f4ed-4063-4c44-af8b-39050bd44926",
			"events": {
				"11a9b5ee-17c0-4159-9bbf-454dcfdcd5c3": {
					"name": "StartEvent1"
				},
				"2798f4e7-bc42-4fad-a248-159095a2f40a": {
					"name": "EndEvent1"
				}
			},
			"activities": {
				"a1b2c3d4-e5f6-7890-abcd-ef1234567890": {
					"name": "Envio Correo"
				}
			},
			"sequenceFlows": {
				"c6b99f32-5fe6-4ab6-b60a-80fba1b9ae0f": {
					"name": "SequenceFlow1"
				},
				"f1e2d3c4-b5a6-9876-5432-109876543210": {
					"name": "SequenceFlow2"
				}
			},
			"diagrams": {
				"42fa7a2d-c526-4a02-b3ba-49b5168ba644": {}
			}
		},
		"11a9b5ee-17c0-4159-9bbf-454dcfdcd5c3": {
			"classDefinition": "com.sap.bpm.wfs.StartEvent",
			"id": "startevent1",
			"name": "StartEvent1"
		},
		"2798f4e7-bc42-4fad-a248-159095a2f40a": {
			"classDefinition": "com.sap.bpm.wfs.EndEvent",
			"id": "endevent1",
			"name": "EndEvent1"
		},
		"a1b2c3d4-e5f6-7890-abcd-ef1234567890": {
			"classDefinition": "com.sap.bpm.wfs.MailTask",
			"destinationSource": "consumer",
			"id": "mailtask1",
			"name": "Envio Correo",
			"mailDefinitionRef": "maildef-turnos-001"
		},
		"c6b99f32-5fe6-4ab6-b60a-80fba1b9ae0f": {
			"classDefinition": "com.sap.bpm.wfs.SequenceFlow",
			"id": "sequenceflow1",
			"name": "SequenceFlow1",
			"sourceRef": "11a9b5ee-17c0-4159-9bbf-454dcfdcd5c3",
			"targetRef": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
		},
		"f1e2d3c4-b5a6-9876-5432-109876543210": {
			"classDefinition": "com.sap.bpm.wfs.SequenceFlow",
			"id": "sequenceflow2",
			"name": "SequenceFlow2",
			"sourceRef": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
			"targetRef": "2798f4e7-bc42-4fad-a248-159095a2f40a"
		},
		"42fa7a2d-c526-4a02-b3ba-49b5168ba644": {
			"classDefinition": "com.sap.bpm.wfs.ui.Diagram",
			"symbols": {
				"df898b52-91e1-4778-baad-2ad9a261d30e": {},
				"53e54950-7757-4161-82c9-afa7e86cff2c": {},
				"6bb141da-d485-4317-93b8-e17711df4c32": {},
				"g9h8i7j6-k5l4-m3n2-o1p0-qrstuvwxyz": {},
				"z9y8x7w6-v5u4-t3s2-r1q0-ponmlkjihg": {}
			}
		},
		"df898b52-91e1-4778-baad-2ad9a261d30e": {
			"classDefinition": "com.sap.bpm.wfs.ui.StartEventSymbol",
			"x": 100,
			"y": 100,
			"width": 32,
			"height": 32,
			"object": "11a9b5ee-17c0-4159-9bbf-454dcfdcd5c3"
		},
		"53e54950-7757-4161-82c9-afa7e86cff2c": {
			"classDefinition": "com.sap.bpm.wfs.ui.EndEventSymbol",
			"x": 480,
			"y": 100,
			"width": 35,
			"height": 35,
			"object": "2798f4e7-bc42-4fad-a248-159095a2f40a"
		},
		"6bb141da-d485-4317-93b8-e17711df4c32": {
			"classDefinition": "com.sap.bpm.wfs.ui.SequenceFlowSymbol",
			"points": "116,116 186.25,116 186.25,130 290,130",
			"sourceSymbol": "df898b52-91e1-4778-baad-2ad9a261d30e",
			"targetSymbol": "g9h8i7j6-k5l4-m3n2-o1p0-qrstuvwxyz",
			"object": "c6b99f32-5fe6-4ab6-b60a-80fba1b9ae0f"
		},
		"g9h8i7j6-k5l4-m3n2-o1p0-qrstuvwxyz": {
			"classDefinition": "com.sap.bpm.wfs.ui.MailTaskSymbol",
			"x": 240,
			"y": 100,
			"width": 100,
			"height": 60,
			"object": "a1b2c3d4-e5f6-7890-abcd-ef1234567890"
		},
		"z9y8x7w6-v5u4-t3s2-r1q0-ponmlkjihg": {
			"classDefinition": "com.sap.bpm.wfs.ui.SequenceFlowSymbol",
			"points": "290,130 410.25,130 410.25,117.5 497.5,117.5",
			"sourceSymbol": "g9h8i7j6-k5l4-m3n2-o1p0-qrstuvwxyz",
			"targetSymbol": "53e54950-7757-4161-82c9-afa7e86cff2c",
			"object": "f1e2d3c4-b5a6-9876-5432-109876543210"
		},
		"62d7f4ed-4063-4c44-af8b-39050bd44926": {
			"classDefinition": "com.sap.bpm.wfs.LastIDs",
			"maildefinition": 1,
			"sequenceflow": 2,
			"startevent": 1,
			"endevent": 1,
			"mailtask": 1
		},
		"maildef-turnos-001": {
			"classDefinition": "com.sap.bpm.wfs.MailDefinition",
			"name": "maildefinition1",
			"to": "${context.Destinatario}",
			"cc": "",
			"subject": "Notificación del Sistema de Turnos",
			"reference": "/webcontent/PlantillaTurno.html",
			"ignoreInvalidRecipients": true,
			"id": "maildefinition1"
		}
	}
}