import UIKit

final class StatSummaryView: UIView {
    private let stackView = UIStackView()
    private let dueValue = UILabel()
    private let learningValue = UILabel()
    private let masteredValue = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    func configure(due: Int, learning: Int, mastered: Int) {
        dueValue.text = "\(due)"
        learningValue.text = "\(learning)"
        masteredValue.text = "\(mastered)"
    }

    private func setup() {
        stackView.axis = .horizontal
        stackView.distribution = .fillEqually
        stackView.spacing = 10
        stackView.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stackView)

        stackView.addArrangedSubview(makeItem(title: "今日到期", valueLabel: dueValue))
        stackView.addArrangedSubview(makeItem(title: "学习中", valueLabel: learningValue))
        stackView.addArrangedSubview(makeItem(title: "已掌握", valueLabel: masteredValue))

        NSLayoutConstraint.activate([
            stackView.topAnchor.constraint(equalTo: topAnchor),
            stackView.leadingAnchor.constraint(equalTo: leadingAnchor),
            stackView.trailingAnchor.constraint(equalTo: trailingAnchor),
            stackView.bottomAnchor.constraint(equalTo: bottomAnchor)
        ])
    }

    private func makeItem(title: String, valueLabel: UILabel) -> UIView {
        let container = UIView()
        container.backgroundColor = .secondarySystemBackground
        container.layer.cornerRadius = 8

        valueLabel.font = .systemFont(ofSize: 24, weight: .bold)
        valueLabel.textColor = .label
        valueLabel.textAlignment = .center
        valueLabel.text = "0"

        let titleLabel = UILabel()
        titleLabel.text = title
        titleLabel.font = .systemFont(ofSize: 12, weight: .medium)
        titleLabel.textColor = .secondaryLabel
        titleLabel.textAlignment = .center

        let stack = UIStackView(arrangedSubviews: [valueLabel, titleLabel])
        stack.axis = .vertical
        stack.alignment = .fill
        stack.spacing = 4
        stack.translatesAutoresizingMaskIntoConstraints = false
        container.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: container.topAnchor, constant: 14),
            stack.leadingAnchor.constraint(equalTo: container.leadingAnchor, constant: 8),
            stack.trailingAnchor.constraint(equalTo: container.trailingAnchor, constant: -8),
            stack.bottomAnchor.constraint(equalTo: container.bottomAnchor, constant: -14)
        ])

        return container
    }
}
