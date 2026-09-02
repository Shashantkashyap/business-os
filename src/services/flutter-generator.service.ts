// This is a stub for the Flutter Code Generator.
// In a full implementation, this would parse the JSON UI Schema AST and recursively build a valid Dart file.
export class FlutterGeneratorService {
  static generateScreenCode(screenName: string, uiSchemaStr: string): string {
    let schema: any;
    try {
      schema = JSON.parse(uiSchemaStr);
    } catch (e) {
      return `import 'package:flutter/material.dart';\n\nclass ${screenName} extends StatelessWidget {\n  @override\n  Widget build(BuildContext context) {\n    return const Scaffold(body: Center(child: Text('Invalid Schema')));\n  }\n}\n`;
    }

    // Basic recursive mapping stub
    const generateWidget = (node: any): string => {
      if (!node) return 'const SizedBox()';
      switch (node.type) {
        case 'Scaffold':
          const appBar = node.children?.find((c: any) => c.type === 'AppBar');
          const body = node.children?.find((c: any) => c.type !== 'AppBar');
          const appBarCode = appBar ? `appBar: ${generateWidget(appBar)},` : '';
          const bodyCode = body ? `body: ${generateWidget(body)},` : '';
          return `Scaffold(\n      backgroundColor: ${node.props?.backgroundColor ? `Color(0xFF${node.props.backgroundColor.replace('#', '')})` : 'null'},\n      ${appBarCode}\n      ${bodyCode}\n    )`;
        case 'AppBar':
          return `AppBar(\n      title: const Text('${node.props?.title || ''}'),\n      backgroundColor: ${node.props?.backgroundColor ? `Color(0xFF${node.props.backgroundColor.replace('#', '')})` : 'null'},\n    )`;
        case 'Center':
          return `Center(\n      child: ${generateWidget(node.children?.[0])},\n    )`;
        case 'Text':
          return `const Text('${node.props?.text || ''}')`;
        default:
          return 'const SizedBox()';
      }
    };

    return `import 'package:flutter/material.dart';

class ${screenName}Screen extends StatelessWidget {
  const ${screenName}Screen({Key? key}) : super(key: key);

  @override
  Widget build(BuildContext context) {
    return ${generateWidget(schema)};
  }
}
`;
  }
}
