import UIKit

final class ReviewCardView: UIView {
    private let wordLabel = UILabel()
    private let phoneticLabel = UILabel()
    private let contextLabel = UILabel()
    private let definitionTitleLabel = UILabel()
    private let definitionLabel = UILabel()

    override init(frame: CGRect) {
        super.init(frame: frame)
        setup()
    }

    required init?(coder: NSCoder) {
        super.init(coder: coder)
        setup()
    }

    func configure(word: String, info: VocabWord, answerVisible: Bool) {
        wordLabel.text = word
        phoneticLabel.text = info.phonetic
        contextLabel.text = info.latestSentence.isEmpty ? "没有保存例句。" : info.latestSentence
        definitionLabel.text = info.definition?.isEmpty == false ? info.definition : "暂无释义。"
        definitionTitleLabel.isHidden = !answerVisible
        definitionLabel.isHidden = !answerVisible
    }

    private func setup() {
        backgroundColor = .secondarySystemBackground
        layer.cornerRadius = 8

        wordLabel.font = .systemFont(ofSize: 36, weight: .bold)
        wordLabel.textColor = .label
        wordLabel.numberOfLines = 0
        wordLabel.adjustsFontSizeToFitWidth = true
        wordLabel.minimumScaleFactor = 0.7

        phoneticLabel.font = .systemFont(ofSize: 15, weight: .medium)
        phoneticLabel.textColor = .secondaryLabel

        contextLabel.font = .italicSystemFont(ofSize: 16)
        contextLabel.textColor = .secondaryLabel
        contextLabel.numberOfLines = 0

        definitionTitleLabel.text = "释义"
        definitionTitleLabel.font = .systemFont(ofSize: 13, weight: .semibold)
        definitionTitleLabel.textColor = .secondaryLabel

        definitionLabel.font = .systemFont(ofSize: 18)
        definitionLabel.textColor = .label
        definitionLabel.numberOfLines = 0

        let headerStack = UIStackView(arrangedSubviews: [wordLabel, phoneticLabel])
        headerStack.axis = .vertical
        headerStack.spacing = 6

        let stack = UIStackView(arrangedSubviews: [
            headerStack,
            contextLabel,
            definitionTitleLabel,
            definitionLabel
        ])
        stack.axis = .vertical
        stack.spacing = 18
        stack.translatesAutoresizingMaskIntoConstraints = false
        addSubview(stack)

        NSLayoutConstraint.activate([
            stack.topAnchor.constraint(equalTo: topAnchor, constant: 24),
            stack.leadingAnchor.constraint(equalTo: leadingAnchor, constant: 20),
            stack.trailingAnchor.constraint(equalTo: trailingAnchor, constant: -20),
            stack.bottomAnchor.constraint(lessThanOrEqualTo: bottomAnchor, constant: -24)
        ])
    }
}
